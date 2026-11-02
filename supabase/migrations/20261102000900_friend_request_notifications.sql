create or replace function public.queue_friend_request_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
begin
  select coalesce(nullif(display_name, ''), username, 'Someone')
    into actor_name
    from public.profiles
   where id = new.sender_id;

  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notification_outbox
      (recipient_id, actor_id, event_type, entity_id, title, body, data, idempotency_key)
    values
      (new.recipient_id, new.sender_id, 'friend_request', new.id, 'New friend request',
       actor_name || ' wants to be friends.',
       jsonb_build_object('url', '/friends', 'requestId', new.id),
       'friend-request:' || new.id::text)
    on conflict (idempotency_key) do nothing;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    insert into public.notification_outbox
      (recipient_id, actor_id, event_type, entity_id, title, body, data, idempotency_key)
    values
      (new.sender_id, new.recipient_id, 'friend_accepted', new.id, 'Friend request accepted',
       'Your friend request was accepted.',
       jsonb_build_object('url', '/friends', 'requestId', new.id),
       'friend-accepted:' || new.id::text)
    on conflict (idempotency_key) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists friend_request_notification_trigger on public.friend_requests;
create trigger friend_request_notification_trigger
after insert or update of status on public.friend_requests
for each row execute function public.queue_friend_request_notification();
