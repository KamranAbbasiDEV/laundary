-- P2: retain bounded retry state for outbound SMS notifications.
alter table public.notification_log
  add column if not exists attempt_count integer not null default 0 check (attempt_count >= 0),
  add column if not exists max_attempts integer not null default 5 check (max_attempts > 0),
  add column if not exists last_attempt_at timestamptz;

create index if not exists notification_log_retry_ready_idx
  on public.notification_log (status, attempt_count, last_attempt_at, created_at)
  where channel = 'sms' and status = 'queued';
