create or replace function public.create_friend_invite()
returns text language plpgsql security definer set search_path = public as $$
declare raw_token text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  raw_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into friend_invites(sender_id, token_hash)
  values (auth.uid(), encode(extensions.digest(raw_token, 'sha256'), 'hex'));
  return raw_token;
end;
$$;

create or replace function public.delete_my_account(confirmation text)
returns void language plpgsql security definer set search_path = public, auth, storage as $$
declare account_id uuid := auth.uid();
begin
  if account_id is null or confirmation <> 'DELETE' then raise exception 'Invalid confirmation'; end if;
  delete from storage.objects
   where bucket_id = 'jello-photos'
     and (storage.foldername(name))[1] = account_id::text;
  delete from auth.users where id = account_id;
end;
$$;

create or replace function public.queue_friend_request_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor_name text;
begin
  select coalesce(nullif(display_name, ''), username, 'Someone')
    into actor_name from profiles where id = new.sender_id;

  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into notification_outbox
      (recipient_id, actor_id, event_type, entity_id, title, body, data, idempotency_key)
    values
      (new.recipient_id, new.sender_id, 'friend_request', new.id, 'New friend request',
       actor_name || ' wants to be friends.',
       jsonb_build_object('url', '/friends', 'requestId', new.id),
       'friend-request:' || new.id::text)
    on conflict (idempotency_key) do nothing;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    insert into notification_outbox
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
