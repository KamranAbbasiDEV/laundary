-- RinseLine core workflow upgrade. Safe to run after supabase/schema.sql.

create table if not exists public.workspace_settings (
  id text primary key default 'default',
  company_name text not null default 'RinseLine',
  timezone text not null default 'UTC',
  operating_days text[] not null default '{monday,tuesday,wednesday,thursday,friday,saturday}',
  holidays date[] not null default '{}',
  pickup_windows jsonb not null default '[]'::jsonb,
  services jsonb not null default '[]'::jsonb,
  turnaround_rules jsonb not null default '{}'::jsonb,
  notification_templates jsonb not null default '{}'::jsonb,
  matching_rules jsonb not null default '{"capability":30,"location":20,"capacity":20,"turnaround":15,"pricing":10,"performance":5}'::jsonb,
  payment_methods text[] not null default '{cash,bank_transfer,card_machine}',
  photo_retention_days integer not null default 180 check (photo_retention_days > 0),
  support_email text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.workspace_settings (id) values ('default') on conflict (id) do nothing;

create table if not exists public.processor_offers (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  processor_id uuid not null references public.processors(id) on delete cascade,
  rank integer not null check (rank > 0),
  score numeric(8,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','expired','withdrawn')),
  rejection_reason text,
  responded_by uuid references auth.users(id) on delete set null,
  offered_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (order_id, processor_id)
);

create table if not exists public.order_handoffs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  stage text not null check (stage in ('customer_pickup','processor_dropoff','processor_pickup','customer_delivery')),
  expected_bags integer not null check (expected_bags >= 0),
  actual_bags integer check (actual_bags >= 0),
  discrepancy text,
  notes text,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_id, stage)
);

create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount_due numeric(12,2) not null default 0 check (amount_due >= 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  status text not null default 'unpaid' check (status in ('unpaid','pending','partially_paid','paid','refunded','disputed','waived')),
  method text,
  reference text,
  notes text,
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id)
);

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  recipient text not null,
  channel text not null check (channel in ('sms','email','in_app')),
  event text not null,
  message text not null,
  status text not null default 'queued' check (status in ('queued','sent','failed','simulated')),
  provider_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.processor_scorecards (
  id uuid primary key default gen_random_uuid(),
  processor_id uuid not null references public.processors(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  orders_completed integer not null default 0,
  on_time_rate numeric(5,2) not null default 0,
  discrepancy_rate numeric(5,2) not null default 0,
  issue_count integer not null default 0,
  score numeric(5,2) not null default 0,
  notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  unique (processor_id, period_start, period_end)
);

create table if not exists public.route_plans (
  id uuid primary key default gen_random_uuid(),
  route_date date not null,
  route_type text not null check (route_type in ('pickup','processor_pickup','delivery')),
  driver_id uuid references auth.users(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','approved','in_progress','complete','failed')),
  mapbox_route jsonb,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.orders add column if not exists assigned_driver_id uuid references auth.users(id) on delete set null;
alter table public.orders add column if not exists actual_bags integer check (actual_bags >= 0);
alter table public.orders add column if not exists processor_bags integer check (processor_bags >= 0);
alter table public.orders add column if not exists completed_bags integer check (completed_bags >= 0);
alter table public.orders add column if not exists delivered_bags integer check (delivered_bags >= 0);
alter table public.orders add column if not exists customer_delivery_address text;
alter table public.route_stops add column if not exists route_id uuid references public.route_plans(id) on delete cascade;
alter table public.route_stops add column if not exists driver_id uuid references auth.users(id) on delete set null;

alter table public.workspace_settings enable row level security;
alter table public.processor_offers enable row level security;
alter table public.order_handoffs enable row level security;
alter table public.payment_records enable row level security;
alter table public.notification_log enable row level security;
alter table public.processor_scorecards enable row level security;
alter table public.route_plans enable row level security;

create policy "operations read settings" on public.workspace_settings for select to authenticated using (public.is_operations_user());
create policy "admins manage settings" on public.workspace_settings for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "operations read processor offers" on public.processor_offers for select to authenticated using (public.is_operations_user() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.processor_id = processor_id));
create policy "operations manage processor offers" on public.processor_offers for all to authenticated using (public.is_operations_user()) with check (public.is_operations_user());
create policy "processors respond to offers" on public.processor_offers for update to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.processor_id = processor_id and p.status = 'active')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.processor_id = processor_id and p.status = 'active'));
create policy "operations manage handoffs" on public.order_handoffs for all to authenticated using (public.is_operations_user()) with check (public.is_operations_user());
create policy "customers read own handoffs" on public.order_handoffs for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.customer_user_id = auth.uid()));
create policy "operations manage payments" on public.payment_records for all to authenticated using (public.current_user_role() in ('super_admin','dispatcher')) with check (public.current_user_role() in ('super_admin','dispatcher'));
create policy "customers read own payments" on public.payment_records for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.customer_user_id = auth.uid()));
create policy "admins read notifications" on public.notification_log for select to authenticated using (public.current_user_role() in ('super_admin','dispatcher'));
create policy "operations read scorecards" on public.processor_scorecards for select to authenticated using (public.is_operations_user());
create policy "admins manage scorecards" on public.processor_scorecards for all to authenticated using (public.current_user_role() in ('super_admin','dispatcher')) with check (public.current_user_role() in ('super_admin','dispatcher'));
create policy "operations manage route plans" on public.route_plans for all to authenticated using (public.current_user_role() in ('super_admin','dispatcher','driver')) with check (public.current_user_role() in ('super_admin','dispatcher','driver'));
