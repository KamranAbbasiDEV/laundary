-- P0 operational execution: durable exceptions, route-stop state, and driver location.
-- Safe to apply after 20261014_core_workflow_upgrade.sql.

alter table public.exceptions add column if not exists stage text;
alter table public.exceptions add column if not exists status text not null default 'open' check (status in ('open','in_review','resolved'));
alter table public.exceptions add column if not exists issue_code text;
alter table public.exceptions add column if not exists evidence_required boolean not null default false;
alter table public.exceptions add column if not exists opened_by uuid references auth.users(id) on delete set null;
alter table public.exceptions add column if not exists assigned_to uuid references auth.users(id) on delete set null;
alter table public.exceptions add column if not exists resolution_notes text;
alter table public.exceptions add column if not exists source_handoff_id uuid references public.order_handoffs(id) on delete set null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'exceptions_stage_check' and conrelid = 'public.exceptions'::regclass) then
    alter table public.exceptions add constraint exceptions_stage_check check (stage is null or stage in ('customer_pickup','processor_dropoff','processor_pickup','customer_delivery','processing','route')) not valid;
    alter table public.exceptions validate constraint exceptions_stage_check;
  end if;
end $$;
create unique index if not exists exceptions_source_handoff_id_idx on public.exceptions (source_handoff_id) where source_handoff_id is not null;
create index if not exists exceptions_open_queue_idx on public.exceptions (status, created_at desc) where status <> 'resolved';

alter table public.route_stops add column if not exists status text not null default 'planned' check (status in ('planned','arrived','completed','failed','skipped'));
alter table public.route_stops add column if not exists failure_reason text;
alter table public.route_stops add column if not exists completed_by uuid references auth.users(id) on delete set null;
alter table public.route_stops add column if not exists latitude double precision;
alter table public.route_stops add column if not exists longitude double precision;
create index if not exists route_stops_route_status_idx on public.route_stops (route_id, status);

create table if not exists public.driver_location_events (
  id uuid primary key default gen_random_uuid(),
  route_id uuid references public.route_plans(id) on delete cascade,
  driver_id uuid not null references auth.users(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_meters numeric(10,2),
  recorded_at timestamptz not null default now()
);
create index if not exists driver_location_events_recent_idx on public.driver_location_events (route_id, recorded_at desc);
alter table public.driver_location_events enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'driver_location_events' and policyname = 'drivers write own locations') then
    create policy "drivers write own locations" on public.driver_location_events for insert to authenticated with check (driver_id = auth.uid() and public.current_user_role() = 'driver');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'driver_location_events' and policyname = 'operations read driver locations') then
    create policy "operations read driver locations" on public.driver_location_events for select to authenticated using (public.current_user_role() in ('super_admin','dispatcher') or driver_id = auth.uid());
  end if;
end $$;

alter table public.orders add column if not exists intake_source text not null default 'app';
alter table public.orders add column if not exists external_id text;
create unique index if not exists orders_intake_source_external_id_idx on public.orders (intake_source, external_id) where external_id is not null;
