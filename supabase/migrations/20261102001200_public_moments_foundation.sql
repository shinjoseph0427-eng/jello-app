alter table public.moments add column if not exists visibility text not null default 'private' check (visibility in ('private','public'));
alter table public.moments add column if not exists published_at timestamptz;
alter table public.moments add column if not exists public_caption text check (char_length(public_caption) <= 280);

create table if not exists public.moment_public_consents (
  moment_id uuid not null references public.moments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  consented_at timestamptz not null default now(),
  primary key (moment_id,user_id)
);
create table if not exists public.public_moment_likes (
  moment_id uuid not null references public.moments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (moment_id,user_id)
);
create index if not exists public_moments_feed on public.moments(published_at desc) where visibility = 'public';
create index if not exists public_moment_likes_count on public.public_moment_likes(moment_id);
alter table public.moment_public_consents enable row level security;
alter table public.public_moment_likes enable row level security;
create policy "participants read public consents" on public.moment_public_consents for select to authenticated using (
  exists(select 1 from public.moments m where m.id=moment_id and auth.uid() in (m.initiator_id,m.responder_id))
);
create policy "public likes visible" on public.public_moment_likes for select to authenticated using (
  exists(select 1 from public.moments m where m.id=moment_id and m.visibility='public')
);

create or replace function public.set_moment_public_consent(target_moment_id uuid, consent boolean, caption text default null)
returns text language plpgsql security definer set search_path=public as $$
declare target moments%rowtype; approval_count integer;
begin
  select * into target from moments where id=target_moment_id and auth.uid() in (initiator_id,responder_id) for update;
  if not found or target.status <> 'completed' then raise exception 'Completed moment not found'; end if;
  if consent then
    insert into moment_public_consents(moment_id,user_id) values(target_moment_id,auth.uid()) on conflict do nothing;
    if caption is not null then update moments set public_caption=nullif(trim(caption),'') where id=target_moment_id; end if;
  else
    delete from moment_public_consents where moment_id=target_moment_id and user_id=auth.uid();
    update moments set visibility='private',published_at=null where id=target_moment_id;
  end if;
  select count(*)::integer into approval_count from moment_public_consents where moment_id=target_moment_id;
  if approval_count=2 then
    update moments set visibility='public',published_at=coalesce(published_at,now()) where id=target_moment_id;
    return 'public';
  end if;
  return case when consent then 'waiting_for_other' else 'private' end;
end;
$$;

create or replace function public.list_public_moments(result_limit integer default 30, before_time timestamptz default null)
returns table(
  id uuid, initiator_id uuid, responder_id uuid, initiator_name text, responder_name text,
  side_one_path text, side_two_path text, layout text, caption text, published_at timestamptz,
  like_count bigint, liked_by_me boolean, rank_score double precision
)
language sql stable security definer set search_path=public as $$
  select m.id,m.initiator_id,m.responder_id,pi.display_name,pr.display_name,
    max(ph.storage_path) filter(where ph.side=1),max(ph.storage_path) filter(where ph.side=2),m.layout,m.public_caption,m.published_at,
    count(distinct l.user_id),bool_or(l.user_id=auth.uid()),
    (case when exists(select 1 from friendships f where auth.uid() in (f.user_low,f.user_high) and (m.initiator_id in (f.user_low,f.user_high) or m.responder_id in (f.user_low,f.user_high))) then 50 else 0 end
      + least(count(distinct l.user_id)::double precision,100)*2
      - extract(epoch from (now()-m.published_at))/86400.0) as rank_score
  from moments m join profiles pi on pi.id=m.initiator_id join profiles pr on pr.id=m.responder_id
  join photos ph on ph.moment_id=m.id left join public_moment_likes l on l.moment_id=m.id
  where auth.uid() is not null and m.visibility='public' and m.status='completed'
    and (before_time is null or m.published_at<before_time)
    and not exists(select 1 from blocks b where b.blocker_id=auth.uid() and b.blocked_id in (m.initiator_id,m.responder_id) or b.blocked_id=auth.uid() and b.blocker_id in (m.initiator_id,m.responder_id))
  group by m.id,pi.display_name,pr.display_name
  order by rank_score desc,m.published_at desc limit least(greatest(result_limit,1),50);
$$;

create or replace function public.toggle_public_moment_like(target_moment_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from moments where id=target_moment_id and visibility='public' and status='completed') then raise exception 'Moment unavailable'; end if;
  if exists(select 1 from public_moment_likes where moment_id=target_moment_id and user_id=auth.uid()) then
    delete from public_moment_likes where moment_id=target_moment_id and user_id=auth.uid(); return false;
  end if;
  insert into public_moment_likes(moment_id,user_id) values(target_moment_id,auth.uid()); return true;
end;
$$;

create or replace function public.report_moment(target_moment_id uuid, report_reason text, report_details text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare target_user uuid; report_id uuid;
begin
  if report_reason not in ('nudity','harassment','violence','impersonation','spam','other') then raise exception 'Invalid report reason'; end if;
  select case when auth.uid()=initiator_id then responder_id else initiator_id end into target_user from moments
    where id=target_moment_id and (auth.uid() in (initiator_id,responder_id) or visibility='public');
  if target_user is null then raise exception 'Moment not found'; end if;
  insert into reports(reporter_id,reported_user_id,moment_id,reason,details)
  values(auth.uid(),target_user,target_moment_id,report_reason,nullif(trim(report_details),'')) returning id into report_id;
  return report_id;
end;
$$;

drop policy if exists "photo object participant read" on storage.objects;
create policy "photo object participant or public read" on storage.objects for select to authenticated using (
  bucket_id='jello-photos' and exists(
    select 1 from public.photos p join public.moments m on m.id=p.moment_id where p.storage_path=name
      and (auth.uid() in (m.initiator_id,m.responder_id) or m.visibility='public')
      and not exists(select 1 from public.blocks b where (b.blocker_id=auth.uid() and b.blocked_id in (m.initiator_id,m.responder_id)) or (b.blocked_id=auth.uid() and b.blocker_id in (m.initiator_id,m.responder_id)))
  )
);

revoke all on function public.set_moment_public_consent(uuid,boolean,text) from public;
revoke all on function public.list_public_moments(integer,timestamptz) from public;
revoke all on function public.toggle_public_moment_like(uuid) from public;
grant execute on function public.set_moment_public_consent(uuid,boolean,text) to authenticated;
grant execute on function public.list_public_moments(integer,timestamptz) to authenticated;
grant execute on function public.toggle_public_moment_like(uuid) to authenticated;
