-- Preserve the human-readable pickup window while adding values that can be validated.
alter table public.orders add column if not exists pickup_window_start_at timestamptz;
alter table public.orders add column if not exists pickup_window_end_at timestamptz;

create index if not exists orders_pickup_window_end_idx
  on public.orders (pickup_window_end_at);
