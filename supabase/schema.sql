create type public.order_status as enum ('created','validated','processor_ranked','capacity_confirmed','pickup_scheduled','picked_up','at_processor','processing','ready_for_pickup','picked_up_from_processor','qc_reconciliation','out_for_delivery','delivered','processor_reviewed');
create type public.order_priority as enum ('standard','priority','same_day');
create type public.exception_type as enum ('pickup_discrepancy','processor_discrepancy','quality_issue','damaged_item','route_issue','missing_customer_specification');
create type public.app_role as enum ('super_admin','dispatcher','driver','processor','customer');
create type public.account_status as enum ('pending','active','suspended','rejected','deactivated');
create type public.invitation_status as enum ('pending','accepted','revoked','expired');
create type public.processor_application_status as enum ('pending','approved','rejected','withdrawn');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'customer',
  status public.account_status not null default 'active',
  phone text,
  avatar_url text,
  address text,
  service_zones text[] not null default '{}',
  availability text,
  vehicle_details text,
  onboarding_complete boolean not null default false,
  processor_id uuid,
  driver_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_user_role() returns public.app_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$ begin
  insert into public.profiles (id, full_name, role) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 'customer');
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create table public.orders (
  id uuid primary key default gen_random_uuid(), order_number text not null unique default ('RL-' || floor(random() * 900000 + 100000)::text), customer_name text not null, phone text not null,
  pickup_address text not null, service_type text not null, item_description text, expected_bags integer not null check (expected_bags > 0), customer_user_id uuid references auth.users(id),
  due_at timestamptz, due_at_label text, pickup_window_start_at timestamptz, pickup_window_end_at timestamptz, priority public.order_priority not null default 'standard',
  status public.order_status not null default 'created', processor_id uuid, notes text, has_exception boolean not null default false, original_due_at timestamptz, deadline_revised_at timestamptz, deadline_revised_by uuid references auth.users(id) on delete set null, deadline_revision_reason text, customer_exception_message text, customer_exception_notified_at timestamptz, archived_at timestamptz, archived_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.deadline_revisions (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  previous_original_due_at timestamptz, original_due_at timestamptz,
  previous_committed_due_at timestamptz, committed_due_at timestamptz,
  reason text, changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index deadline_revisions_order_idx on public.deadline_revisions (order_id, changed_at desc);
create table public.processors (
  id uuid primary key default gen_random_uuid(), name text not null, address text, service_area text, capabilities text[] not null default '{}', pricing text, capacity_limit integer not null default 0, capacity_percent integer not null default 0, operating_hours text, turnaround_hours numeric(8,2), performance_score numeric(5,2) not null default 0, phone text, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_processor_id_fkey'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_processor_id_fkey
      foreign key (processor_id)
      references public.processors(id)
      on delete set null;
  end if;
end $$;
create table public.order_events (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, from_status public.order_status, to_status public.order_status not null, actor_id uuid, note text, created_at timestamptz not null default now()
);
create table public.exceptions (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, type public.exception_type not null, description text not null, severity text not null default 'medium', deadline_impact text not null default 'none', deadline_before timestamptz, deadline_after timestamptz, deadline_reason text, customer_message text, customer_notified_at timestamptz, customer_notified_by uuid references auth.users(id) on delete set null, resolved_at timestamptz, resolved_by uuid, created_at timestamptz not null default now()
);
create table public.route_stops (
  id uuid primary key default gen_random_uuid(), route_date date not null, route_type text not null check(route_type in ('pickup','processor_pickup','delivery')), order_id uuid not null references public.orders(id) on delete cascade, sequence integer not null, window_start timestamptz, window_end timestamptz, driver_name text, checked_in_at timestamptz, completed_at timestamptz
);
create table public.order_photos (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, storage_path text not null, kind text not null, mime_type text not null, size_bytes integer not null, created_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role public.app_role not null check (role in ('dispatcher','driver','processor')),
  full_name text not null,
  phone text,
  processor_id uuid references public.processors(id) on delete set null,
  invited_by uuid not null references auth.users(id) on delete restrict,
  auth_user_id uuid references auth.users(id) on delete set null,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (email, role, status)
);

create table public.processor_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_user_id uuid references auth.users(id) on delete set null,
  business_name text not null,
  contact_name text not null,
  email text not null,
  phone text not null,
  address text not null,
  service_area text,
  capabilities text[] not null default '{}',
  pricing text,
  capacity_limit integer not null default 0 check (capacity_limit >= 0),
  operating_hours text,
  turnaround_hours numeric(8,2),
  notes text,
  status public.processor_application_status not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;
alter table public.deadline_revisions enable row level security;
alter table public.profiles enable row level security;
alter table public.processors enable row level security;
alter table public.order_events enable row level security;
alter table public.exceptions enable row level security;
alter table public.route_stops enable row level security;
alter table public.order_photos enable row level security;
alter table public.invitations enable row level security;
alter table public.processor_applications enable row level security;
alter table public.audit_log enable row level security;
create policy "authenticated staff can manage orders" on public.orders for all to authenticated using (true) with check (true);
create policy "users can read their own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.current_user_role() = 'dispatcher');
create policy "users can update their own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "dispatchers can manage profiles" on public.profiles for all to authenticated using (public.current_user_role() = 'dispatcher') with check (public.current_user_role() = 'dispatcher');
create policy "authenticated staff can manage processors" on public.processors for all to authenticated using (true) with check (true);
create policy "authenticated staff can manage events" on public.order_events for all to authenticated using (true) with check (true);
create policy "authenticated staff can manage exceptions" on public.exceptions for all to authenticated using (true) with check (true);
create policy "authenticated staff can manage routes" on public.route_stops for all to authenticated using (true) with check (true);
create policy "authenticated staff can manage photos" on public.order_photos for all to authenticated using (true) with check (true);
insert into storage.buckets (id, name, public) values ('order-photos', 'order-photos', false) on conflict (id) do nothing;
create policy "authenticated staff can upload order photos" on storage.objects for insert to authenticated with check (bucket_id = 'order-photos');
create policy "authenticated staff can read order photos" on storage.objects for select to authenticated using (bucket_id = 'order-photos');

-- Replace broad policies with role-aware production policies.
drop policy if exists "authenticated staff can manage orders" on public.orders;
drop policy if exists "authenticated staff can manage processors" on public.processors;
drop policy if exists "authenticated staff can manage events" on public.order_events;
drop policy if exists "authenticated staff can manage exceptions" on public.exceptions;
drop policy if exists "authenticated staff can manage routes" on public.route_stops;
drop policy if exists "authenticated staff can manage photos" on public.order_photos;
drop policy if exists "authenticated staff can upload order photos" on storage.objects;
drop policy if exists "authenticated staff can read order photos" on storage.objects;

drop policy if exists "users can read their own profile" on public.profiles;
drop policy if exists "users can update their own profile" on public.profiles;
drop policy if exists "dispatchers can manage profiles" on public.profiles;
drop policy if exists "staff can read orders" on public.orders;
drop policy if exists "staff and customers can create orders" on public.orders;
drop policy if exists "operations can update orders" on public.orders;
drop policy if exists "processors can read assigned records" on public.processors;
drop policy if exists "dispatchers manage processors" on public.processors;
drop policy if exists "operations can read events" on public.order_events;
drop policy if exists "operations can create events" on public.order_events;
drop policy if exists "operations can manage exceptions" on public.exceptions;
drop policy if exists "operations can manage routes" on public.route_stops;
drop policy if exists "operations can manage photos" on public.order_photos;
drop policy if exists "operations can upload order photos" on storage.objects;
drop policy if exists "operations can read order photos" on storage.objects;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin' and status = 'active') $$;

create or replace function public.is_operations_user() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role in ('super_admin','dispatcher','driver','processor') and status = 'active') $$;

create or replace function public.protect_profile_access_fields() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() = old.id and not public.is_super_admin() then
    new.role := old.role;
    new.status := old.status;
    new.processor_id := old.processor_id;
    new.driver_id := old.driver_id;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_access_fields on public.profiles;
create trigger protect_profile_access_fields before update on public.profiles
for each row execute procedure public.protect_profile_access_fields();

create policy "users can read their own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.is_super_admin() or public.current_user_role() = 'dispatcher');
create policy "users can update their own profile" on public.profiles for update to authenticated using (id = auth.uid() and status = 'active') with check (id = auth.uid());
create policy "super admins manage profiles" on public.profiles for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy "authorized users can read orders" on public.orders for select to authenticated using (public.is_operations_user() or customer_user_id = auth.uid());
create policy "operations read deadline revisions" on public.deadline_revisions for select to authenticated using (public.is_operations_user());
create policy "operations create deadline revisions" on public.deadline_revisions for insert to authenticated with check (public.is_operations_user());
create policy "customers and dispatch can create orders" on public.orders for insert to authenticated with check (public.current_user_role() in ('super_admin','dispatcher') or (public.current_user_role() = 'customer' and customer_user_id = auth.uid()));
create policy "operations can update orders" on public.orders for update to authenticated using (public.is_operations_user()) with check (public.is_operations_user());
create policy "super admins delete orders" on public.orders for delete to authenticated using (public.is_super_admin());

create policy "operations can read processors" on public.processors for select to authenticated using (public.is_operations_user());
create policy "admins manage processors" on public.processors for all to authenticated using (public.is_super_admin() or public.current_user_role() = 'dispatcher') with check (public.is_super_admin() or public.current_user_role() = 'dispatcher');

create policy "authorized users can read events" on public.order_events for select to authenticated using (public.is_operations_user() or exists (select 1 from public.orders o where o.id = order_id and o.customer_user_id = auth.uid()));
create policy "operations can create events" on public.order_events for insert to authenticated with check (public.is_operations_user());
create policy "operations can manage exceptions" on public.exceptions for all to authenticated using (public.is_operations_user()) with check (public.is_operations_user());
create policy "operations can manage routes" on public.route_stops for all to authenticated using (public.current_user_role() in ('super_admin','dispatcher','driver')) with check (public.current_user_role() in ('super_admin','dispatcher','driver'));
create policy "operations can manage photos" on public.order_photos for all to authenticated using (public.is_operations_user()) with check (public.is_operations_user());
create policy "operations can upload order photos" on storage.objects for insert to authenticated with check (bucket_id = 'order-photos' and public.is_operations_user());
create policy "operations can read order photos" on storage.objects for select to authenticated using (bucket_id = 'order-photos' and public.is_operations_user());

create policy "public can submit processor applications" on public.processor_applications for insert to anon, authenticated with check (status = 'pending');
create policy "admins can read processor applications" on public.processor_applications for select to authenticated using (public.is_super_admin() or public.current_user_role() = 'dispatcher');
create policy "admins can update processor applications" on public.processor_applications for update to authenticated using (public.is_super_admin() or public.current_user_role() = 'dispatcher') with check (public.is_super_admin() or public.current_user_role() = 'dispatcher');
create policy "users can read their own applications" on public.processor_applications for select to authenticated using (applicant_user_id = auth.uid());
create policy "admins can manage invitations" on public.invitations for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "admins can read audit log" on public.audit_log for select to authenticated using (public.is_super_admin() or public.current_user_role() = 'dispatcher');
create policy "super admins write audit log" on public.audit_log for insert to authenticated with check (public.is_super_admin());
