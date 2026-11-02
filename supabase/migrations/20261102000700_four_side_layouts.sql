alter table public.moments drop constraint if exists moments_layout_check;

update public.moments
set layout = case layout
  when 'vertical' then 'left'
  when 'horizontal' then 'top'
  else layout
end;

alter table public.moments alter column layout set default 'left';
alter table public.moments
add constraint moments_layout_check check (layout in ('left', 'right', 'top', 'bottom'));

create or replace function public.create_moment(target_id uuid, request_key uuid, selected_layout text default 'left')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare moment_id uuid;
begin
  if selected_layout not in ('left', 'right', 'top', 'bottom') then raise exception 'Invalid moment layout'; end if;
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
