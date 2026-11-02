-- Make small mobile-photo uploads safely retryable after a lost response.

create policy "photo object owner select"
on storage.objects for select to authenticated
using (bucket_id = 'jello-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "photo object owner update"
on storage.objects for update to authenticated
using (bucket_id = 'jello-photos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'jello-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "photo object owner delete"
on storage.objects for delete to authenticated
using (bucket_id = 'jello-photos' and (storage.foldername(name))[1] = auth.uid()::text);

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
declare existing_photo photos%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if photo_side not in (1, 2) or photo_width <= 0 or photo_height <= 0 then raise exception 'Invalid photo metadata'; end if;
  if object_path <> auth.uid()::text || '/' || target_moment_id::text || '/' || photo_side::text || '.jpg' then raise exception 'Invalid photo path'; end if;

  select * into moment_row from moments where id = target_moment_id for update;
  if not found then raise exception 'Moment not found'; end if;

  select * into existing_photo from photos where moment_id = target_moment_id and side = photo_side;
  if found then
    if existing_photo.owner_id = auth.uid() and existing_photo.storage_path = object_path then return; end if;
    raise exception 'Photo side already belongs to another object';
  end if;

  if moment_row.expires_at <= now() then raise exception 'Moment expired'; end if;
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
