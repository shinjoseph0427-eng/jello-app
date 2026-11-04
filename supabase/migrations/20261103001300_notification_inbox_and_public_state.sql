-- Durable in-app notification inbox, independent from push delivery state.
alter table public.notification_outbox drop constraint if exists notification_outbox_event_type_check;
alter table public.notification_outbox add constraint notification_outbox_event_type_check check (
  event_type in ('friend_request','friend_accepted','moment_received','moment_completed','reaction','public_approval_requested','moment_published')
);

create table if not exists public.notification_inbox (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null unique references public.notification_outbox(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  entity_id uuid,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notification_inbox_recipient_created
  on public.notification_inbox(recipient_id, created_at desc) where dismissed_at is null;
create index if not exists notification_inbox_recipient_unread
  on public.notification_inbox(recipient_id, created_at desc) where read_at is null and dismissed_at is null;
alter table public.notification_inbox enable row level security;
revoke all on public.notification_inbox from anon, authenticated;

create or replace function public.mirror_notification_to_inbox()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into notification_inbox(outbox_id,recipient_id,actor_id,event_type,entity_id,title,body,data,created_at)
  values(new.id,new.recipient_id,new.actor_id,new.event_type,new.entity_id,new.title,new.body,new.data,new.created_at)
  on conflict(outbox_id) do nothing;
  return new;
end;
$$;
drop trigger if exists notification_outbox_to_inbox on public.notification_outbox;
create trigger notification_outbox_to_inbox after insert on public.notification_outbox
for each row execute function public.mirror_notification_to_inbox();

insert into public.notification_inbox(outbox_id,recipient_id,actor_id,event_type,entity_id,title,body,data,created_at)
select id,recipient_id,actor_id,event_type,entity_id,title,body,data,created_at from public.notification_outbox
on conflict(outbox_id) do nothing;

create or replace function public.list_notifications(result_limit integer default 40, before_time timestamptz default null)
returns table(
  id uuid, event_type text, entity_id uuid, title text, body text, data jsonb,
  actor_id uuid, actor_name text, actor_avatar_path text, read_at timestamptz, created_at timestamptz
)
language sql stable security definer set search_path=public as $$
  select n.id,n.event_type,n.entity_id,n.title,n.body,n.data,n.actor_id,p.display_name,p.avatar_path,n.read_at,n.created_at
  from notification_inbox n left join profiles p on p.id=n.actor_id
  where n.recipient_id=auth.uid() and n.dismissed_at is null
    and (before_time is null or n.created_at<before_time)
    and not exists(
      select 1 from blocks b where n.actor_id is not null and
      ((b.blocker_id=auth.uid() and b.blocked_id=n.actor_id) or (b.blocked_id=auth.uid() and b.blocker_id=n.actor_id))
    )
  order by n.created_at desc limit least(greatest(result_limit,1),100);
$$;

create or replace function public.notification_unread_count()
returns integer language sql stable security definer set search_path=public as $$
  select count(*)::integer from notification_inbox
  where recipient_id=auth.uid() and read_at is null and dismissed_at is null;
$$;

create or replace function public.mark_notification_read(target_notification_id uuid)
returns void language sql security definer set search_path=public as $$
  update notification_inbox set read_at=coalesce(read_at,now())
  where id=target_notification_id and recipient_id=auth.uid() and dismissed_at is null;
$$;

create or replace function public.mark_all_notifications_read()
returns void language sql security definer set search_path=public as $$
  update notification_inbox set read_at=now()
  where recipient_id=auth.uid() and read_at is null and dismissed_at is null;
$$;

create or replace function public.dismiss_notification(target_notification_id uuid)
returns void language sql security definer set search_path=public as $$
  update notification_inbox set dismissed_at=now(),read_at=coalesce(read_at,now())
  where id=target_notification_id and recipient_id=auth.uid();
$$;

-- Public sharing is a two-person state machine. Notify the other participant at each meaningful transition.
create or replace function public.queue_public_consent_notification()
returns trigger language plpgsql security definer set search_path=public as $$
declare target moments%rowtype; recipient uuid; actor_name text; approvals integer;
begin
  select * into target from moments where id=new.moment_id;
  recipient := case when target.initiator_id=new.user_id then target.responder_id else target.initiator_id end;
  select display_name into actor_name from profiles where id=new.user_id;
  select count(*)::integer into approvals from moment_public_consents where moment_id=new.moment_id;
  if approvals=1 then
    insert into notification_outbox(recipient_id,actor_id,event_type,entity_id,title,body,data,idempotency_key)
    values(recipient,new.user_id,'public_approval_requested',new.moment_id,'Share this moment publicly?',actor_name||' approved public sharing. It stays private until you approve.',jsonb_build_object('url','/moments','momentId',new.moment_id),'public-approval:'||new.moment_id::text||':'||new.user_id::text)
    on conflict(idempotency_key) do nothing;
  elsif approvals=2 then
    insert into notification_outbox(recipient_id,actor_id,event_type,entity_id,title,body,data,idempotency_key)
    values(recipient,new.user_id,'moment_published',new.moment_id,'Your moment is public',actor_name||' approved it too. You can make it private any time.',jsonb_build_object('url','/moments','momentId',new.moment_id),'moment-published:'||new.moment_id::text||':'||new.user_id::text)
    on conflict(idempotency_key) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists moment_public_consent_notification on public.moment_public_consents;
create trigger moment_public_consent_notification after insert on public.moment_public_consents
for each row execute function public.queue_public_consent_notification();

-- Return visibility and both approvals with each private moment. UI never has to infer state.
drop function if exists public.list_moments();
create function public.list_moments()
returns table(
  id uuid, status moment_status, initiator_id uuid, responder_id uuid,
  other_display_name text, side_one_path text, side_two_path text,
  created_at timestamptz, completed_at timestamptz, expires_at timestamptz,
  layout text, visibility text, public_caption text, published_at timestamptz,
  approved_by_me boolean, approved_by_other boolean
)
language sql stable security definer set search_path=public as $$
  select m.id,m.status,m.initiator_id,m.responder_id,p.display_name,
    max(ph.storage_path) filter(where ph.side=1),max(ph.storage_path) filter(where ph.side=2),
    m.created_at,m.completed_at,m.expires_at,m.layout,m.visibility,m.public_caption,m.published_at,
    exists(select 1 from moment_public_consents c where c.moment_id=m.id and c.user_id=auth.uid()),
    exists(select 1 from moment_public_consents c where c.moment_id=m.id and c.user_id<>auth.uid())
  from moments m
  join profiles p on p.id=case when m.initiator_id=auth.uid() then m.responder_id else m.initiator_id end
  left join photos ph on ph.moment_id=m.id
  where auth.uid() in (m.initiator_id,m.responder_id) and m.status not in ('cancelled','failed')
  group by m.id,p.display_name order by m.created_at desc limit 100;
$$;

-- Correct boolean precedence in public feed block filtering.
create or replace function public.list_public_moments(result_limit integer default 30, before_time timestamptz default null)
returns table(
  id uuid, initiator_id uuid, responder_id uuid, initiator_name text, responder_name text,
  side_one_path text, side_two_path text, layout text, caption text, published_at timestamptz,
  like_count bigint, liked_by_me boolean, rank_score double precision
)
language sql stable security definer set search_path=public as $$
  select m.id,m.initiator_id,m.responder_id,pi.display_name,pr.display_name,
    max(ph.storage_path) filter(where ph.side=1),max(ph.storage_path) filter(where ph.side=2),m.layout,m.public_caption,m.published_at,
    count(distinct l.user_id),coalesce(bool_or(l.user_id=auth.uid()),false),
    (case when exists(select 1 from friendships f where auth.uid() in (f.user_low,f.user_high) and (m.initiator_id in (f.user_low,f.user_high) or m.responder_id in (f.user_low,f.user_high))) then 50 else 0 end
      + least(count(distinct l.user_id)::double precision,100)*2
      - extract(epoch from (now()-m.published_at))/86400.0) as rank_score
  from moments m join profiles pi on pi.id=m.initiator_id join profiles pr on pr.id=m.responder_id
  join photos ph on ph.moment_id=m.id left join public_moment_likes l on l.moment_id=m.id
  where auth.uid() is not null and m.visibility='public' and m.status='completed'
    and (before_time is null or m.published_at<before_time)
    and not exists(select 1 from blocks b where
      (b.blocker_id=auth.uid() and b.blocked_id in (m.initiator_id,m.responder_id)) or
      (b.blocked_id=auth.uid() and b.blocker_id in (m.initiator_id,m.responder_id)))
  group by m.id,pi.display_name,pr.display_name
  order by rank_score desc,m.published_at desc limit least(greatest(result_limit,1),50);
$$;

revoke all on function public.list_notifications(integer,timestamptz) from public;
revoke all on function public.notification_unread_count() from public;
revoke all on function public.mark_notification_read(uuid) from public;
revoke all on function public.mark_all_notifications_read() from public;
revoke all on function public.dismiss_notification(uuid) from public;
revoke all on function public.list_moments() from public;
grant execute on function public.list_notifications(integer,timestamptz) to authenticated;
grant execute on function public.notification_unread_count() to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.dismiss_notification(uuid) to authenticated;
grant execute on function public.list_moments() to authenticated;
