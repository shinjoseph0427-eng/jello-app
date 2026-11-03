create table if not exists public.push_delivery_tickets (
  ticket_id text primary key,
  outbox_id uuid not null references public.notification_outbox(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  push_token text not null,
  status text not null default 'pending' check (status in ('pending','delivered','failed')),
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  checked_at timestamptz
);
create index if not exists push_delivery_tickets_pending on public.push_delivery_tickets(created_at) where status = 'pending';
alter table public.push_delivery_tickets enable row level security;
revoke all on public.push_delivery_tickets from anon, authenticated;
