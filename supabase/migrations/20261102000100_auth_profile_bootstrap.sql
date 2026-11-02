create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_username text;
  generated_name text;
begin
  generated_username := 'user_' || substring(replace(new.id::text, '-', '') from 1 for 12);
  generated_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'New friend'
  );

  insert into public.profiles (id, username, display_name)
  values (new.id, generated_username, left(generated_name, 50))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, username, display_name)
select
  u.id,
  'user_' || substring(replace(u.id::text, '-', '') from 1 for 12),
  left(coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'New friend'), 50)
from auth.users u
on conflict (id) do nothing;

create policy "profiles self insert"
on public.profiles for insert to authenticated
with check (id = auth.uid());

create or replace function public.search_profiles(query text, result_limit integer default 20)
returns table(id uuid, username text, display_name text, avatar_path text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_path
  from public.profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = auth.uid())
    )
    and (p.username ilike '%' || trim(query) || '%' or p.display_name ilike '%' || trim(query) || '%')
  order by case when lower(p.username) = lower(trim(query)) then 0 else 1 end, p.username
  limit least(greatest(result_limit, 1), 20);
$$;

revoke all on function public.search_profiles(text, integer) from public;
grant execute on function public.search_profiles(text, integer) to authenticated;
