-- P1: structured intake/classification and editable route-stop sequencing.
-- Apply after 20261018_p0_operational_execution.sql.

alter table public.orders add column if not exists textile_types text[] not null default '{}';
alter table public.orders add column if not exists special_handling text[] not null default '{}';
alter table public.orders add column if not exists customer_specifications text;
alter table public.orders add column if not exists validation_state text not null default 'validated' check (validation_state in ('validated','manual_review','resolved'));
alter table public.orders add column if not exists validation_reason text;
alter table public.orders add column if not exists validated_at timestamptz;
alter table public.orders add column if not exists validated_by uuid references auth.users(id) on delete set null;
create index if not exists orders_validation_queue_idx on public.orders (validation_state, created_at desc) where validation_state <> 'resolved';

alter table public.processor_offers add column if not exists expires_at timestamptz;
alter table public.processor_offers add column if not exists score_breakdown jsonb not null default '{}'::jsonb;
create index if not exists processor_offers_pending_expiry_idx on public.processor_offers (status, expires_at) where status = 'pending';

alter table public.route_stops add column if not exists dispatcher_note text;
create unique index if not exists route_stops_route_sequence_idx on public.route_stops (route_id, sequence) where route_id is not null;
