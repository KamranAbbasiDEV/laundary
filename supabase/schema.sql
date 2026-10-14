create type public.order_status as enum ('created','validated','processor_ranked','capacity_confirmed','pickup_scheduled','picked_up','at_processor','processing','ready_for_pickup','picked_up_from_processor','qc_reconciliation','out_for_delivery','delivered','processor_reviewed');
create type public.order_priority as enum ('standard','priority','same_day');
create type public.exception_type as enum ('pickup_discrepancy','processor_discrepancy','quality_issue','damaged_item','route_issue','missing_customer_specification');

create table public.orders (
  id uuid primary key default gen_random_uuid(), order_number text not null unique default ('RL-' || floor(random() * 900000 + 100000)::text), customer_name text not null, phone text not null,
  pickup_address text not null, service_type text not null, item_description text, expected_bags integer not null check (expected_bags > 0),
  due_at timestamptz, due_at_label text, priority public.order_priority not null default 'standard',
  status public.order_status not null default 'created', processor_id uuid, notes text, has_exception boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.processors (
  id uuid primary key default gen_random_uuid(), name text not null, service_area text, capabilities text[] not null default '{}', capacity_percent integer not null default 0, performance_score numeric(5,2) not null default 0, active boolean not null default true, created_at timestamptz not null default now()
);
create table public.order_events (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, from_status public.order_status, to_status public.order_status not null, actor_id uuid, note text, created_at timestamptz not null default now()
);
create table public.exceptions (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, type public.exception_type not null, description text not null, severity text not null default 'medium', resolved_at timestamptz, resolved_by uuid, created_at timestamptz not null default now()
);
create table public.route_stops (
  id uuid primary key default gen_random_uuid(), route_date date not null, route_type text not null check(route_type in ('pickup','processor_pickup','delivery')), order_id uuid not null references public.orders(id) on delete cascade, sequence integer not null, window_start timestamptz, window_end timestamptz, driver_name text, checked_in_at timestamptz, completed_at timestamptz
);
create table public.order_photos (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, storage_path text not null, kind text not null, mime_type text not null, size_bytes integer not null, created_at timestamptz not null default now()
);

alter table public.orders enable row level security;
alter table public.processors enable row level security;
alter table public.order_events enable row level security;
alter table public.exceptions enable row level security;
alter table public.route_stops enable row level security;
alter table public.order_photos enable row level security;
create policy "authenticated staff can manage orders" on public.orders for all to authenticated using (true) with check (true);
create policy "authenticated staff can manage processors" on public.processors for all to authenticated using (true) with check (true);
create policy "authenticated staff can manage events" on public.order_events for all to authenticated using (true) with check (true);
create policy "authenticated staff can manage exceptions" on public.exceptions for all to authenticated using (true) with check (true);
create policy "authenticated staff can manage routes" on public.route_stops for all to authenticated using (true) with check (true);
create policy "authenticated staff can manage photos" on public.order_photos for all to authenticated using (true) with check (true);
insert into storage.buckets (id, name, public) values ('order-photos', 'order-photos', false) on conflict (id) do nothing;
create policy "authenticated staff can upload order photos" on storage.objects for insert to authenticated with check (bucket_id = 'order-photos');
create policy "authenticated staff can read order photos" on storage.objects for select to authenticated using (bucket_id = 'order-photos');
