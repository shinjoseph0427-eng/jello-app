alter table public.moments
add column if not exists layout text not null default 'vertical'
check (layout in ('vertical', 'horizontal'));

drop function if exists public.create_moment(uuid, uuid);
create function public.create_moment(target_id uuid, request_key uuid, selected_layout text default 'vertical')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare moment_id uuid;
begin
  if selected_layout not in ('vertical', 'horizontal') then raise exception 'Invalid moment layout'; end if;
  if not exists (
    select 1 from friendships
    where user_low = least(auth.uid(), target_id) and user_high = greatest(auth.uid(), target_id)
  ) then raise exception 'You can only send moments to friends'; end if;

  insert into moments(initiator_id, responder_id, idempotency_key, layout)
  values (auth.uid(), target_id, request_key, selected_layout)
  on conflict (initiator_id, idempotency_key) do update set idempotency_key = excluded.idempotency_key
  returning id into moment_id;
  return moment_id;
end;
$$;

drop function if exists public.list_moments();
create function public.list_moments()
returns table(
  id uuid, status moment_status, initiator_id uuid, responder_id uuid,
  other_display_name text, side_one_path text, side_two_path text,
  created_at timestamptz, completed_at timestamptz, expires_at timestamptz,
  layout text
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.status, m.initiator_id, m.responder_id, p.display_name,
    max(ph.storage_path) filter (where ph.side = 1),
    max(ph.storage_path) filter (where ph.side = 2),
    m.created_at, m.completed_at, m.expires_at, m.layout
  from moments m
  join profiles p on p.id = case when m.initiator_id = auth.uid() then m.responder_id else m.initiator_id end
  left join photos ph on ph.moment_id = m.id
  where auth.uid() in (m.initiator_id, m.responder_id)
    and m.status not in ('cancelled', 'failed')
  group by m.id, p.display_name
  order by m.created_at desc
  limit 100;
$$;

revoke all on function public.create_moment(uuid, uuid, text) from public;
revoke all on function public.list_moments() from public;
grant execute on function public.create_moment(uuid, uuid, text) to authenticated;
grant execute on function public.list_moments() to authenticated;
