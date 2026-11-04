create or replace function public.queue_public_like_notification()
returns trigger language plpgsql security definer set search_path=public as $$
declare target moments%rowtype; actor_name text; recipient uuid;
begin
  select * into target from moments where id=new.moment_id and visibility='public';
  if not found then return new; end if;
  select display_name into actor_name from profiles where id=new.user_id;
  foreach recipient in array array[target.initiator_id,target.responder_id] loop
    if recipient<>new.user_id then
      insert into notification_outbox(recipient_id,actor_id,event_type,entity_id,title,body,data,idempotency_key)
      values(recipient,new.user_id,'reaction',new.moment_id,'Someone liked your moment',actor_name||' liked your public Jello.',jsonb_build_object('url','/discover','momentId',new.moment_id),'public-like:'||new.moment_id::text||':'||new.user_id::text||':'||recipient::text)
      on conflict(idempotency_key) do nothing;
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists public_moment_like_notification on public.public_moment_likes;
create trigger public_moment_like_notification after insert on public.public_moment_likes
for each row execute function public.queue_public_like_notification();
