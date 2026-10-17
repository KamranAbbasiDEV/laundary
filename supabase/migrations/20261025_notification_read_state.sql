-- Persist notification read state per authenticated user instead of browser-only storage.
create table if not exists public.notification_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_id uuid not null references public.notification_log(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, notification_id)
);

alter table public.notification_reads enable row level security;

create policy "users manage own notification reads" on public.notification_reads
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists notification_reads_user_idx on public.notification_reads (user_id, read_at desc);
