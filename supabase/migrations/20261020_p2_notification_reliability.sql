-- P2: per-user notification preferences and retry-safe notification operations.
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  in_app_enabled boolean not null default true,
  sms_enabled boolean not null default true,
  processor_offer_sms boolean not null default true,
  route_update_sms boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notification_preferences' and policyname = 'users manage own notification preferences') then
    create policy "users manage own notification preferences" on public.notification_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
create index if not exists notification_log_retry_idx on public.notification_log (status, created_at) where channel = 'sms' and status = 'queued';
