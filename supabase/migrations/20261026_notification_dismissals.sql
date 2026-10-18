-- Persist per-user notification tray clearing without deleting shared operational history.
create table if not exists public.notification_dismissals (
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_id uuid not null references public.notification_log(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, notification_id)
);

alter table public.notification_dismissals enable row level security;

create policy "users manage own notification dismissals" on public.notification_dismissals
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists notification_dismissals_user_idx on public.notification_dismissals (user_id, dismissed_at desc);
