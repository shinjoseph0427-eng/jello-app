-- Close-friends model inspired by the public behavior of Locket:
-- exact username discovery, explicit approval, and a small trusted circle.

create or replace function public.friend_count(target_user uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from friendships where target_user in (user_low, user_high);
$$;

create or replace function public.search_profiles(query text, result_limit integer default 20)
returns table(id uuid, username text, display_name text, avatar_path text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_path
  from profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and lower(p.username) = lower(trim(leading '@' from trim(query)))
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = auth.uid())
    )
  limit 1;
$$;

create or replace function public.send_friend_request(target_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare request_id uuid;
begin
  if auth.uid() is null or target_id = auth.uid() then raise exception 'Invalid friend request'; end if;
  if public.friend_count(auth.uid()) >= 20 then raise exception 'Your close-friends circle is full'; end if;
  if public.friend_count(target_id) >= 20 then raise exception 'Their close-friends circle is full'; end if;
  if not exists (select 1 from profiles where id = target_id) then raise exception 'Profile not found'; end if;
  if exists (select 1 from friendships where user_low = least(auth.uid(), target_id) and user_high = greatest(auth.uid(), target_id)) then raise exception 'Already friends'; end if;
  if exists (select 1 from blocks where (blocker_id = auth.uid() and blocked_id = target_id) or (blocker_id = target_id and blocked_id = auth.uid())) then raise exception 'Profile unavailable'; end if;
  select id into request_id from friend_requests where status = 'pending' and ((sender_id = auth.uid() and recipient_id = target_id) or (sender_id = target_id and recipient_id = auth.uid())) limit 1;
  if request_id is not null then return request_id; end if;
  insert into friend_requests(sender_id, recipient_id) values (auth.uid(), target_id) returning id into request_id;
  return request_id;
end;
$$;

create or replace function public.respond_friend_request(request_id uuid, accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare request_row friend_requests%rowtype;
begin
  select * into request_row from friend_requests where id = request_id and recipient_id = auth.uid() and status = 'pending' for update;
  if not found then raise exception 'Friend request not found'; end if;
  if accept and (public.friend_count(auth.uid()) >= 20 or public.friend_count(request_row.sender_id) >= 20) then raise exception 'A close-friends circle is full'; end if;
  update friend_requests set status = case when accept then 'accepted' else 'rejected' end, responded_at = now() where id = request_id;
  if accept then insert into friendships(user_low, user_high) values (least(request_row.sender_id, request_row.recipient_id), greatest(request_row.sender_id, request_row.recipient_id)) on conflict do nothing; end if;
end;
$$;

create or replace function public.remove_friend(target_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from friendships where user_low = least(auth.uid(), target_id) and user_high = greatest(auth.uid(), target_id);
end;
$$;

revoke all on function public.friend_count(uuid) from public;
revoke all on function public.remove_friend(uuid) from public;
grant execute on function public.remove_friend(uuid) to authenticated;
