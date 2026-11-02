create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  moment_id uuid references public.moments(id) on delete set null,
  reason text not null check (reason in ('nudity','harassment','violence','impersonation','spam','other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_user_id)
);

create table if not exists public.friend_invites (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  accepted_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists friend_invites_sender_created on public.friend_invites(sender_id, created_at desc);

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  device_id text not null,
  platform text not null check (platform in ('ios','android')),
  app_version text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, device_id)
);

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('friend_request','friend_accepted','moment_received','moment_completed','reaction')),
  entity_id uuid,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','cancelled')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index if not exists notification_outbox_pending on public.notification_outbox(status, available_at) where status in ('pending','failed');

alter table public.reports enable row level security;
alter table public.friend_invites enable row level security;
alter table public.push_tokens enable row level security;
alter table public.notification_outbox enable row level security;

create policy "reports reporter insert" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "reports reporter read" on public.reports for select to authenticated using (reporter_id = auth.uid());
create policy "invites sender read" on public.friend_invites for select to authenticated using (sender_id = auth.uid());
create policy "push tokens owner" on public.push_tokens for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.block_user(target_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or target_id = auth.uid() then raise exception 'Invalid block'; end if;
  insert into blocks(blocker_id, blocked_id) values (auth.uid(), target_id) on conflict do nothing;
  delete from friendships where user_low = least(auth.uid(), target_id) and user_high = greatest(auth.uid(), target_id);
  update friend_requests set status = 'cancelled', responded_at = now()
    where status = 'pending' and ((sender_id = auth.uid() and recipient_id = target_id) or (sender_id = target_id and recipient_id = auth.uid()));
  update moments set status = 'cancelled'
    where status not in ('cancelled','failed','expired') and auth.uid() in (initiator_id,responder_id) and target_id in (initiator_id,responder_id);
  update notification_outbox set status = 'cancelled', processed_at = now()
    where status in ('pending','failed') and ((recipient_id = auth.uid() and actor_id = target_id) or (recipient_id = target_id and actor_id = auth.uid()));
end;
$$;

create or replace function public.unblock_user(target_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from blocks where blocker_id = auth.uid() and blocked_id = target_id;
$$;

create or replace function public.list_blocked_users()
returns table(id uuid, username text, display_name text, avatar_path text, blocked_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_path, b.created_at
  from blocks b join profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid() order by b.created_at desc;
$$;

create or replace function public.report_moment(target_moment_id uuid, report_reason text, report_details text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare target_user uuid; report_id uuid;
begin
  if report_reason not in ('nudity','harassment','violence','impersonation','spam','other') then raise exception 'Invalid report reason'; end if;
  select case when initiator_id = auth.uid() then responder_id else initiator_id end into target_user
  from moments where id = target_moment_id and auth.uid() in (initiator_id,responder_id);
  if target_user is null then raise exception 'Moment not found'; end if;
  insert into reports(reporter_id, reported_user_id, moment_id, reason, details)
  values (auth.uid(), target_user, target_moment_id, report_reason, nullif(trim(report_details), '')) returning id into report_id;
  return report_id;
end;
$$;

create or replace function public.create_friend_invite()
returns text language plpgsql security definer set search_path = public as $$
declare raw_token text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  raw_token := encode(gen_random_bytes(24), 'hex');
  insert into friend_invites(sender_id, token_hash) values (auth.uid(), encode(extensions.digest(raw_token, 'sha256'), 'hex'));
  return raw_token;
end;
$$;

create or replace function public.get_friend_invite(raw_token text)
returns table(sender_id uuid, username text, display_name text, avatar_path text, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_path, i.expires_at
  from friend_invites i join profiles p on p.id = i.sender_id
  where i.token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
    and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
  limit 1;
$$;

create or replace function public.accept_friend_invite(raw_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare invite_row friend_invites%rowtype;
begin
  select * into invite_row from friend_invites
  where token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex') for update;
  if not found or invite_row.revoked_at is not null or invite_row.expires_at <= now() then raise exception 'Invite unavailable'; end if;
  if invite_row.accepted_at is not null then
    if invite_row.accepted_by = auth.uid() then return invite_row.sender_id; end if;
    raise exception 'Invite already used';
  end if;
  if auth.uid() is null or invite_row.sender_id = auth.uid() then raise exception 'Invalid invite'; end if;
  if exists(select 1 from blocks where (blocker_id=auth.uid() and blocked_id=invite_row.sender_id) or (blocker_id=invite_row.sender_id and blocked_id=auth.uid())) then raise exception 'Invite unavailable'; end if;
  if public.friend_count(auth.uid()) >= 20 or public.friend_count(invite_row.sender_id) >= 20 then raise exception 'A close-friends circle is full'; end if;
  insert into friendships(user_low,user_high) values (least(auth.uid(),invite_row.sender_id),greatest(auth.uid(),invite_row.sender_id)) on conflict do nothing;
  update friend_invites set accepted_by=auth.uid(), accepted_at=now() where id=invite_row.id;
  insert into notification_outbox(recipient_id,actor_id,event_type,entity_id,title,body,data,idempotency_key)
  values(invite_row.sender_id,auth.uid(),'friend_accepted',auth.uid(),'New Jello friend','Your invite was accepted.',jsonb_build_object('url','/friends'),'invite-accepted:'||invite_row.id::text)
  on conflict(idempotency_key) do nothing;
  return invite_row.sender_id;
end;
$$;

create or replace function public.register_push_token(push_token text, target_device_id text, target_platform text, target_app_version text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if push_token is null or char_length(push_token) > 512 then raise exception 'Invalid push token'; end if;
  insert into push_tokens(user_id,token,device_id,platform,app_version,enabled,last_seen_at)
  values(auth.uid(),push_token,target_device_id,target_platform,target_app_version,true,now())
  on conflict(user_id,device_id) do update set token=excluded.token,platform=excluded.platform,app_version=excluded.app_version,enabled=true,last_seen_at=now();
end;
$$;

create or replace function public.delete_my_account(confirmation text)
returns void language plpgsql security definer set search_path = public, auth, storage as $$
declare current_user uuid := auth.uid();
begin
  if current_user is null or confirmation <> 'DELETE' then raise exception 'Invalid confirmation'; end if;
  delete from storage.objects where bucket_id='jello-photos' and (storage.foldername(name))[1]=current_user::text;
  delete from auth.users where id=current_user;
end;
$$;

create or replace function public.queue_moment_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor_name text;
begin
  if new.status = old.status then return new; end if;
  if new.status = 'waiting_for_friend' then
    select display_name into actor_name from profiles where id=new.initiator_id;
    insert into notification_outbox(recipient_id,actor_id,event_type,entity_id,title,body,data,idempotency_key)
    values(new.responder_id,new.initiator_id,'moment_received',new.id,'Your side is waiting',actor_name||' sent you a Jello.',jsonb_build_object('url','/reply/'||new.id::text),'moment-received:'||new.id::text) on conflict(idempotency_key) do nothing;
  elsif new.status = 'completed' then
    select display_name into actor_name from profiles where id=new.responder_id;
    insert into notification_outbox(recipient_id,actor_id,event_type,entity_id,title,body,data,idempotency_key)
    values(new.initiator_id,new.responder_id,'moment_completed',new.id,'Two Sides complete',actor_name||' completed your moment.',jsonb_build_object('url','/moments'),'moment-completed:'||new.id::text) on conflict(idempotency_key) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists moments_queue_notification on public.moments;
create trigger moments_queue_notification after update of status on public.moments for each row execute function public.queue_moment_notification();

drop policy if exists "photo object participant read" on storage.objects;
create policy "photo object participant read" on storage.objects for select to authenticated using (
  bucket_id='jello-photos' and exists(
    select 1 from public.photos p join public.moments m on m.id=p.moment_id
    where p.storage_path=name and auth.uid() in (m.initiator_id,m.responder_id)
      and not exists(select 1 from public.blocks b where (b.blocker_id=m.initiator_id and b.blocked_id=m.responder_id) or (b.blocker_id=m.responder_id and b.blocked_id=m.initiator_id))
  )
);

revoke all on function public.block_user(uuid) from public;
revoke all on function public.unblock_user(uuid) from public;
revoke all on function public.list_blocked_users() from public;
revoke all on function public.report_moment(uuid,text,text) from public;
revoke all on function public.create_friend_invite() from public;
revoke all on function public.get_friend_invite(text) from public;
revoke all on function public.accept_friend_invite(text) from public;
revoke all on function public.register_push_token(text,text,text,text) from public;
revoke all on function public.delete_my_account(text) from public;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.list_blocked_users() to authenticated;
grant execute on function public.report_moment(uuid,text,text) to authenticated;
grant execute on function public.create_friend_invite() to authenticated;
grant execute on function public.get_friend_invite(text) to authenticated;
grant execute on function public.accept_friend_invite(text) to authenticated;
grant execute on function public.register_push_token(text,text,text,text) to authenticated;
grant execute on function public.delete_my_account(text) to authenticated;
