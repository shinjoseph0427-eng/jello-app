create table if not exists public.public_moment_impressions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  moment_id uuid not null references public.moments(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  view_count integer not null default 1 check (view_count > 0),
  primary key(user_id,moment_id)
);
create index if not exists public_moment_impressions_recent on public.public_moment_impressions(user_id,last_seen_at desc);
alter table public.public_moment_impressions enable row level security;
revoke all on public.public_moment_impressions from anon,authenticated;

create or replace function public.record_public_moment_impressions(moment_ids uuid[])
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or coalesce(array_length(moment_ids,1),0)>50 then raise exception 'Invalid impressions'; end if;
  insert into public_moment_impressions(user_id,moment_id)
  select auth.uid(),m.id from moments m where m.id=any(moment_ids) and m.visibility='public' and m.status='completed'
  on conflict(user_id,moment_id) do update set last_seen_at=now(),view_count=public_moment_impressions.view_count+1;
end;
$$;

create or replace function public.list_public_moments_v2(result_limit integer default 20, result_offset integer default 0)
returns table(
  id uuid, initiator_id uuid, responder_id uuid, initiator_name text, responder_name text,
  side_one_path text, side_two_path text, layout text, caption text, published_at timestamptz,
  like_count bigint, liked_by_me boolean, rank_score double precision
)
language sql stable security definer set search_path=public as $$
  with candidates as (
    select m.id,m.initiator_id,m.responder_id,pi.display_name initiator_name,pr.display_name responder_name,
      max(ph.storage_path) filter(where ph.side=1) side_one_path,max(ph.storage_path) filter(where ph.side=2) side_two_path,
      m.layout,m.public_caption caption,m.published_at,count(distinct l.user_id) like_count,
      coalesce(bool_or(l.user_id=auth.uid()),false) liked_by_me,
      coalesce(i.view_count,0) view_count,
      row_number() over(partition by least(m.initiator_id,m.responder_id),greatest(m.initiator_id,m.responder_id) order by m.published_at desc) pair_position,
      case when exists(select 1 from friendships f where auth.uid() in(f.user_low,f.user_high) and (m.initiator_id in(f.user_low,f.user_high) or m.responder_id in(f.user_low,f.user_high))) then 40.0 else 0.0 end friend_score
    from moments m join profiles pi on pi.id=m.initiator_id join profiles pr on pr.id=m.responder_id
    join photos ph on ph.moment_id=m.id left join public_moment_likes l on l.moment_id=m.id
    left join public_moment_impressions i on i.moment_id=m.id and i.user_id=auth.uid()
    where auth.uid() is not null and m.visibility='public' and m.status='completed'
      and not exists(select 1 from blocks b where
        (b.blocker_id=auth.uid() and b.blocked_id in(m.initiator_id,m.responder_id)) or
        (b.blocked_id=auth.uid() and b.blocker_id in(m.initiator_id,m.responder_id)))
    group by m.id,pi.display_name,pr.display_name,i.view_count
  ), ranked as (
    select c.*,(c.friend_score + least(c.like_count::double precision,100)*2.0
      - extract(epoch from(now()-c.published_at))/86400.0
      - least(c.view_count,5)*8.0 - greatest(c.pair_position-1,0)*12.0) score
    from candidates c
  )
  select r.id,r.initiator_id,r.responder_id,r.initiator_name,r.responder_name,r.side_one_path,r.side_two_path,
    r.layout,r.caption,r.published_at,r.like_count,r.liked_by_me,r.score
  from ranked r order by r.score desc,r.published_at desc,r.id
  limit least(greatest(result_limit,1),50) offset least(greatest(result_offset,0),5000);
$$;

revoke all on function public.record_public_moment_impressions(uuid[]) from public;
revoke all on function public.list_public_moments_v2(integer,integer) from public;
grant execute on function public.record_public_moment_impressions(uuid[]) to authenticated;
grant execute on function public.list_public_moments_v2(integer,integer) to authenticated;
