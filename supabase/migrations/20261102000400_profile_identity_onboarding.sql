alter table public.profiles
add column if not exists username_completed boolean not null default false;

create or replace function public.set_profile_identity(requested_username text, requested_display_name text)
returns table(id uuid, username text, display_name text, avatar_path text, username_completed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_username text := lower(trim(leading '@' from trim(requested_username)));
  normalized_name text := trim(requested_display_name);
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode = '28000'; end if;
  if normalized_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Username must be 3–24 characters using letters, numbers, or underscores' using errcode = '22023';
  end if;
  if char_length(normalized_name) < 1 or char_length(normalized_name) > 50 then
    raise exception 'Display name must be 1–50 characters' using errcode = '22023';
  end if;

  return query
  update public.profiles p
  set username = normalized_username,
      display_name = normalized_name,
      username_completed = true,
      updated_at = now()
  where p.id = auth.uid()
  returning p.id, p.username, p.display_name, p.avatar_path, p.username_completed;
exception
  when unique_violation then
    raise exception 'That username is already taken' using errcode = '23505';
end;
$$;

revoke all on function public.set_profile_identity(text, text) from public;
grant execute on function public.set_profile_identity(text, text) to authenticated;
