-- Secure server-side operations for the first complete Jello loop:
-- friend request -> first photo -> reply photo -> completed moment.

create or replace function public.send_friend_request(target_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare request_id uuid;
begin
  if auth.uid() is null or target_id = auth.uid() then
    raise exception 'Invalid friend request';
  end if;
  if not exists (select 1 from profiles where id = target_id) then
    raise exception 'Profile not found';
  end if;
  if exists (
    select 1 from friendships
    where user_low = least(auth.uid(), target_id) and user_high = greatest(auth.uid(), target_id)
  ) then
    raise exception 'Already friends';
  end if;
  if exists (
    select 1 from blocks
    where (blocker_id = auth.uid() and blocked_id = target_id)
       or (blocker_id = target_id and blocked_id = auth.uid())
  ) then
    raise exception 'Profile unavailable';
  end if;

  select id into request_id from friend_requests
  where status = 'pending'
    and ((sender_id = auth.uid() and recipient_id = target_id)
      or (sender_id = target_id and recipient_id = auth.uid()))
  limit 1;

  if request_id is not null then return request_id; end if;

  insert into friend_requests(sender_id, recipient_id)
  values (auth.uid(), target_id)
  returning id into request_id;
  return request_id;
end;
$$;

create or replace function public.respond_friend_request(request_id uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare request_row friend_requests%rowtype;
begin
  select * into request_row from friend_requests
  where id = request_id and recipient_id = auth.uid() and status = 'pending'
  for update;
  if not found then raise exception 'Friend request not found'; end if;

  update friend_requests
  set status = case when accept then 'accepted' else 'rejected' end, responded_at = now()
  where id = request_id;

  if accept then
    insert into friendships(user_low, user_high)
    values (least(request_row.sender_id, request_row.recipient_id), greatest(request_row.sender_id, request_row.recipient_id))
    on conflict do nothing;
  end if;
end;
$$;

create or replace function public.list_friends()
returns table(id uuid, username text, display_name text, avatar_path text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_path
  from friendships f
  join profiles p on p.id = case when f.user_low = auth.uid() then f.user_high else f.user_low end
  where auth.uid() in (f.user_low, f.user_high)
  order by lower(p.display_name);
$$;

create or replace function public.list_incoming_friend_requests()
returns table(request_id uuid, sender_id uuid, username text, display_name text, avatar_path text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, p.id, p.username, p.display_name, p.avatar_path, r.created_at
  from friend_requests r join profiles p on p.id = r.sender_id
  where r.recipient_id = auth.uid() and r.status = 'pending'
  order by r.created_at desc;
$$;

create or replace function public.create_moment(target_id uuid, request_key uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare moment_id uuid;
begin
  if not exists (
    select 1 from friendships
    where user_low = least(auth.uid(), target_id) and user_high = greatest(auth.uid(), target_id)
  ) then raise exception 'You can only send moments to friends'; end if;

  insert into moments(initiator_id, responder_id, idempotency_key)
  values (auth.uid(), target_id, request_key)
  on conflict (initiator_id, idempotency_key) do update set idempotency_key = excluded.idempotency_key
  returning id into moment_id;
  return moment_id;
end;
$$;

create or replace function public.attach_moment_photo(
  target_moment_id uuid,
  photo_side smallint,
  object_path text,
  photo_width integer,
  photo_height integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare moment_row moments%rowtype;
begin
  select * into moment_row from moments where id = target_moment_id for update;
  if not found then raise exception 'Moment not found'; end if;
  if moment_row.expires_at <= now() then raise exception 'Moment expired'; end if;
  if object_path <> auth.uid()::text || '/' || target_moment_id::text || '/' || photo_side::text || '.jpg' then
    raise exception 'Invalid photo path';
  end if;
  if (photo_side = 1 and (moment_row.initiator_id <> auth.uid() or moment_row.status <> 'pending_upload'))
     or (photo_side = 2 and (moment_row.responder_id <> auth.uid() or moment_row.status <> 'waiting_for_friend')) then
    raise exception 'Photo cannot be attached in this state';
  end if;

  insert into photos(moment_id, owner_id, side, storage_path, width, height)
  values (target_moment_id, auth.uid(), photo_side, object_path, photo_width, photo_height);

  update moments set
    status = case when photo_side = 1 then 'waiting_for_friend'::moment_status else 'completed'::moment_status end,
    completed_at = case when photo_side = 2 then now() else completed_at end
  where id = target_moment_id;
end;
$$;

create or replace function public.list_moments()
returns table(
  id uuid, status moment_status, initiator_id uuid, responder_id uuid,
  other_display_name text, side_one_path text, side_two_path text,
  created_at timestamptz, completed_at timestamptz, expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.status, m.initiator_id, m.responder_id, p.display_name,
    max(ph.storage_path) filter (where ph.side = 1),
    max(ph.storage_path) filter (where ph.side = 2),
    m.created_at, m.completed_at, m.expires_at
  from moments m
  join profiles p on p.id = case when m.initiator_id = auth.uid() then m.responder_id else m.initiator_id end
  left join photos ph on ph.moment_id = m.id
  where auth.uid() in (m.initiator_id, m.responder_id)
    and m.status not in ('cancelled', 'failed')
  group by m.id, p.display_name
  order by m.created_at desc
  limit 100;
$$;

revoke all on function public.send_friend_request(uuid) from public;
revoke all on function public.respond_friend_request(uuid, boolean) from public;
revoke all on function public.list_friends() from public;
revoke all on function public.list_incoming_friend_requests() from public;
revoke all on function public.create_moment(uuid, uuid) from public;
revoke all on function public.attach_moment_photo(uuid, smallint, text, integer, integer) from public;
revoke all on function public.list_moments() from public;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.list_friends() to authenticated;
grant execute on function public.list_incoming_friend_requests() to authenticated;
grant execute on function public.create_moment(uuid, uuid) to authenticated;
grant execute on function public.attach_moment_photo(uuid, smallint, text, integer, integer) to authenticated;
grant execute on function public.list_moments() to authenticated;
