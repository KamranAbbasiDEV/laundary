-- Staff-owned lightweight CRM and structured, multi-service order intake.
-- Customer accounts remain trackable, but customers cannot create their own orders.

create table if not exists public.customer_accounts (
  id uuid primary key default gen_random_uuid(),
  account_type text not null check (account_type in ('person', 'company')),
  display_name text not null,
  company_name text,
  contact_name text,
  email text,
  phone text,
  notes text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (account_type <> 'company' or nullif(trim(company_name), '') is not null)
);

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.customer_accounts(id) on delete cascade,
  label text not null default 'Primary',
  address text not null,
  latitude double precision,
  longitude double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customer_addresses_one_default_idx
  on public.customer_addresses (account_id) where is_default;
create index if not exists customer_accounts_name_idx on public.customer_accounts (lower(display_name));
create index if not exists customer_accounts_phone_idx on public.customer_accounts (phone);
create index if not exists customer_addresses_account_idx on public.customer_addresses (account_id);

alter table public.orders add column if not exists customer_account_id uuid references public.customer_accounts(id) on delete set null;
alter table public.orders add column if not exists pickup_latitude double precision;
alter table public.orders add column if not exists pickup_longitude double precision;
alter table public.orders add column if not exists delivery_latitude double precision;
alter table public.orders add column if not exists delivery_longitude double precision;
alter table public.orders add column if not exists delivery_window_start_at timestamptz;
alter table public.orders add column if not exists delivery_window_end_at timestamptz;
alter table public.orders add column if not exists matching_selected_by uuid references auth.users(id) on delete set null;
alter table public.orders add column if not exists matching_selected_at timestamptz;

create index if not exists orders_customer_account_idx on public.orders (customer_account_id);

create table if not exists public.order_services (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  service_name text not null,
  quantity numeric(10,2),
  notes text,
  created_at timestamptz not null default now(),
  unique (order_id, service_name)
);
create index if not exists order_services_order_idx on public.order_services (order_id);

-- service_type remains the compatibility/display field; keep the normalized
-- service rows in lockstep for matching, reporting, and external intake.
create or replace function public.sync_order_services_from_type()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.order_services where order_id = new.id;
  insert into public.order_services (order_id, service_name)
    select new.id, trim(service)
    from unnest(string_to_array(new.service_type, ',')) service
    where nullif(trim(service), '') is not null
    on conflict (order_id, service_name) do nothing;
  return new;
end;
$$;
drop trigger if exists sync_order_services_from_type on public.orders;
create trigger sync_order_services_from_type
after insert or update of service_type on public.orders
for each row execute procedure public.sync_order_services_from_type();

alter table public.customer_accounts enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.order_services enable row level security;

drop policy if exists "dispatch manages customer accounts" on public.customer_accounts;
create policy "dispatch manages customer accounts" on public.customer_accounts
  for all to authenticated using (public.is_dispatch_admin()) with check (public.is_dispatch_admin());

drop policy if exists "dispatch manages customer addresses" on public.customer_addresses;
create policy "dispatch manages customer addresses" on public.customer_addresses
  for all to authenticated using (public.is_dispatch_admin()) with check (public.is_dispatch_admin());

drop policy if exists "authorized users read order services" on public.order_services;
create policy "authorized users read order services" on public.order_services
  for select to authenticated using (public.can_access_order(order_id));
drop policy if exists "dispatch manages order services" on public.order_services;
create policy "dispatch manages order services" on public.order_services
  for all to authenticated using (public.is_dispatch_admin()) with check (public.is_dispatch_admin());

-- Retire customer self-service order intake at the database boundary too.
drop policy if exists "customers create own orders" on public.orders;
drop policy if exists "customers can create orders" on public.orders;
drop policy if exists "customers and dispatch can create orders" on public.orders;
drop policy if exists "staff and customers can create orders" on public.orders;
drop policy if exists "dispatch creates orders" on public.orders;
create policy "dispatch creates orders" on public.orders for insert to authenticated
  with check (public.is_dispatch_admin() and customer_user_id is null);

create or replace function public.protect_order_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
begin
  if auth.uid() is null then return new; end if;
  select * into actor from public.profiles where id = auth.uid() and status = 'active';
  if not found then raise exception 'Active account required'; end if;
  if actor.role not in ('super_admin','dispatcher') then raise exception 'Only dispatch staff can create orders'; end if;
  if new.customer_user_id is not null then raise exception 'Staff-created orders cannot be attached to a customer login'; end if;
  return new;
end;
$$;

-- Keep only one default address per account even if callers race.
create or replace function public.normalize_customer_default_address()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.is_default then
    update public.customer_addresses set is_default = false, updated_at = now()
    where account_id = new.account_id and id is distinct from new.id and is_default;
  elsif tg_op = 'INSERT' then
    if not exists (select 1 from public.customer_addresses where account_id = new.account_id) then new.is_default := true; end if;
  elsif new.account_id is distinct from old.account_id then
    if not exists (select 1 from public.customer_addresses where account_id = new.account_id and id is distinct from new.id) then new.is_default := true; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_customer_default_address on public.customer_addresses;
create trigger normalize_customer_default_address
before insert or update of is_default, account_id on public.customer_addresses
for each row execute procedure public.normalize_customer_default_address();

-- A driver's route can contain any combination of operational stop types.
alter table public.route_plans drop constraint if exists route_plans_route_type_check;
alter table public.route_plans add constraint route_plans_route_type_check
  check (route_type in ('pickup','processor_dropoff','processor_pickup','delivery','mixed'));

create or replace function public.create_mixed_route_plan(
  p_route_date date,
  p_order_ids uuid[],
  p_route_types text[],
  p_driver_id uuid,
  p_mapbox_route jsonb,
  p_longitudes double precision[],
  p_latitudes double precision[]
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  new_plan_id uuid;
  item_index integer;
  plan_route_type text;
  current_status public.order_status;
  required_status public.order_status;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and status = 'active' and role in ('super_admin','dispatcher')) then
    raise exception 'Dispatcher access required';
  end if;
  if not exists (select 1 from public.profiles where id = p_driver_id and role = 'driver' and status = 'active') then
    raise exception 'Select an active driver';
  end if;
  if coalesce(cardinality(p_order_ids), 0) = 0
     or cardinality(p_order_ids) > 25
     or cardinality(p_order_ids) <> cardinality(p_route_types)
     or cardinality(p_order_ids) <> cardinality(p_longitudes)
     or cardinality(p_order_ids) <> cardinality(p_latitudes)
     or cardinality(p_order_ids) <> (select count(*) from (select distinct requested.order_id, requested.route_type from unnest(p_order_ids, p_route_types) as requested(order_id, route_type)) unique_stops)
     or exists (select 1 from unnest(p_route_types) as requested(route_type) where requested.route_type not in ('pickup','processor_dropoff','processor_pickup','delivery')) then
    raise exception 'Route stops and coordinates are invalid';
  end if;

  perform 1 from public.orders where id = any(p_order_ids) for update;
  if (select count(*) from public.orders where id = any(p_order_ids)) <> (select count(distinct requested.order_id) from unnest(p_order_ids) as requested(order_id)) then
    raise exception 'One or more route orders could not be found';
  end if;

  for item_index in 1..cardinality(p_order_ids) loop
    select status into current_status from public.orders where id = p_order_ids[item_index];
    required_status := case p_route_types[item_index]
      when 'pickup' then 'capacity_confirmed'
      when 'processor_dropoff' then 'picked_up'
      when 'processor_pickup' then 'ready_for_pickup'
      when 'delivery' then 'out_for_delivery'
      else null
    end;
    if current_status is distinct from required_status
       and not (
         p_route_types[item_index] = 'processor_dropoff'
         and current_status = 'capacity_confirmed'
         and exists (select 1 from generate_subscripts(p_order_ids, 1) as paired(index) where paired.index < item_index and p_order_ids[paired.index] = p_order_ids[item_index] and p_route_types[paired.index] = 'pickup')
       )
       and not (
         p_route_types[item_index] = 'delivery'
         and current_status = 'ready_for_pickup'
         and exists (select 1 from generate_subscripts(p_order_ids, 1) as paired(index) where paired.index < item_index and p_order_ids[paired.index] = p_order_ids[item_index] and p_route_types[paired.index] = 'processor_pickup')
       ) then
      raise exception 'Order at stop % is no longer eligible for its route action', item_index;
    end if;
    if exists (
      select 1 from public.route_stops route_stop
      join public.route_plans route_plan on route_plan.id = route_stop.route_id
      where route_stop.order_id = p_order_ids[item_index]
        and route_stop.route_type = p_route_types[item_index]
        and route_plan.status in ('draft','approved','in_progress','failed')
    ) then
      raise exception 'Order at stop % already belongs to an open route for this action', item_index;
    end if;
  end loop;

  select case when count(distinct requested.route_type) = 1 then min(requested.route_type) else 'mixed' end
    into plan_route_type from unnest(p_route_types) as requested(route_type);
  insert into public.route_plans (route_date, route_type, driver_id, status, mapbox_route, created_by)
    values (p_route_date, plan_route_type, p_driver_id, 'draft', p_mapbox_route, auth.uid())
    returning id into new_plan_id;
  for item_index in 1..cardinality(p_order_ids) loop
    insert into public.route_stops (route_id, route_date, route_type, order_id, sequence, longitude, latitude)
      values (new_plan_id, p_route_date, p_route_types[item_index], p_order_ids[item_index], item_index, p_longitudes[item_index], p_latitudes[item_index]);
  end loop;
  return new_plan_id;
end;
$$;

revoke all on function public.create_mixed_route_plan(date, uuid[], text[], uuid, jsonb, double precision[], double precision[]) from public, anon, authenticated, service_role;
grant execute on function public.create_mixed_route_plan(date, uuid[], text[], uuid, jsonb, double precision[], double precision[]) to authenticated;

create or replace function public.approve_route_plan(p_plan_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  plan_record public.route_plans%rowtype;
  stop_record record;
  required_status public.order_status;
  next_status public.order_status;
  future_stop boolean;
  pending_count integer := 0;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and status = 'active' and role in ('super_admin','dispatcher')) then
    raise exception 'Dispatcher access required';
  end if;
  select * into plan_record from public.route_plans where id = p_plan_id for update;
  if not found then raise exception 'Route plan not found'; end if;
  if plan_record.status <> 'draft' then raise exception 'Only draft routes can be approved'; end if;
  if plan_record.driver_id is null or not exists (select 1 from public.profiles where id = plan_record.driver_id and role = 'driver' and status = 'active') then
    raise exception 'Select an active driver before approving this route';
  end if;

  for stop_record in
    select route_stop.id as stop_id, route_stop.order_id, route_stop.route_type as stop_type,
           order_record.status as order_status, order_record.order_number
    from public.route_stops route_stop
    join public.orders order_record on order_record.id = route_stop.order_id
    where route_stop.route_id = plan_record.id and route_stop.status <> 'completed'
    order by route_stop.sequence
    for update of route_stop, order_record
  loop
    pending_count := pending_count + 1;
    required_status := case stop_record.stop_type
      when 'pickup' then 'capacity_confirmed'
      when 'processor_dropoff' then 'picked_up'
      when 'processor_pickup' then 'ready_for_pickup'
      when 'delivery' then 'out_for_delivery'
      else null
    end;
    if required_status is null then raise exception 'Unsupported route stop type'; end if;
    next_status := case when stop_record.stop_type = 'pickup' then 'pickup_scheduled' else required_status end;
    future_stop := false;
    if stop_record.stop_type = 'pickup' then
      if stop_record.order_status not in ('capacity_confirmed', 'pickup_scheduled') then
        raise exception 'Order % is no longer eligible for this route', stop_record.order_number;
      end if;
    elsif stop_record.stop_type = 'processor_dropoff'
      and stop_record.order_status in ('capacity_confirmed', 'pickup_scheduled')
      and exists (select 1 from public.route_stops paired where paired.route_id = plan_record.id and paired.order_id = stop_record.order_id and paired.route_type = 'pickup') then
      future_stop := true;
    elsif stop_record.stop_type = 'delivery'
      and stop_record.order_status = 'ready_for_pickup'
      and exists (select 1 from public.route_stops paired where paired.route_id = plan_record.id and paired.order_id = stop_record.order_id and paired.route_type = 'processor_pickup') then
      future_stop := true;
    elsif stop_record.order_status <> required_status then
      raise exception 'Order % is no longer eligible for this route', stop_record.order_number;
    end if;
    if future_stop then
      update public.orders set assigned_driver_id = plan_record.driver_id, updated_at = now() where id = stop_record.order_id;
    else
      update public.orders set assigned_driver_id = plan_record.driver_id, status = next_status, updated_at = now() where id = stop_record.order_id;
    end if;
    update public.route_stops set driver_id = plan_record.driver_id where id = stop_record.stop_id;
    insert into public.order_events (order_id, from_status, to_status, actor_id, note)
      values (stop_record.order_id, stop_record.order_status, case when future_stop then stop_record.order_status else next_status end, auth.uid(), case when future_stop then 'Future ' || replace(stop_record.stop_type, '_', ' ') || ' stop scheduled on the active route.' else 'Route approved for ' || replace(stop_record.stop_type, '_', ' ') || '.' end);
  end loop;
  if pending_count = 0 then raise exception 'This route has no pending stops and cannot be approved'; end if;

  update public.route_plans set status = 'approved', approved_by = auth.uid(), approved_at = now()
    where id = plan_record.id;
  return plan_record.id;
end;
$$;

revoke all on function public.approve_route_plan(uuid) from public, anon, authenticated, service_role;
grant execute on function public.approve_route_plan(uuid) to authenticated;

-- Keep processor acceptance, order advancement, and the visible audit trail in
-- one transaction so the UI never waits on several sequential writes.
create or replace function public.accept_processor_offer(p_offer_id uuid)
returns table (offer_id uuid, order_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  selected_offer public.processor_offers%rowtype;
  selected_order public.orders%rowtype;
  accepted_order_id uuid;
begin
  select * into selected_offer from public.processor_offers where id = p_offer_id for update;
  if not found then raise exception 'Processor offer not found'; end if;
  if selected_offer.status <> 'pending' or (selected_offer.expires_at is not null and selected_offer.expires_at <= now()) then
    raise exception 'This processor offer is no longer available';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'processor' and status = 'active' and processor_id = selected_offer.processor_id) then
    raise exception 'Processor access required';
  end if;

  select * into selected_order from public.orders where id = selected_offer.order_id for update;
  if not found or selected_order.status <> 'processor_ranked' then raise exception 'This order is no longer available for acceptance'; end if;
  update public.orders set processor_id = selected_offer.processor_id, status = 'capacity_confirmed', updated_at = now()
    where id = selected_offer.order_id returning id into accepted_order_id;
  update public.processor_offers set status = 'accepted', rejection_reason = null, responded_by = auth.uid(), responded_at = now()
    where id = selected_offer.id;
  update public.processor_offers offer set status = 'withdrawn'
    where offer.order_id = selected_offer.order_id and offer.id <> selected_offer.id and offer.status in ('pending', 'withdrawn');
  insert into public.order_events (order_id, from_status, to_status, actor_id, note)
    values (selected_offer.order_id, 'processor_ranked', 'capacity_confirmed', auth.uid(), 'Processor accepted the capacity offer.');
  insert into public.notification_log (order_id, recipient, channel, event, message, status, sent_at)
    values (selected_offer.order_id, 'operations', 'in_app', 'processor_offer_accepted', selected_order.order_number || ' was accepted by its processor. Add it to a route and schedule pickup.', 'sent', now());
  return query select selected_offer.id, accepted_order_id;
end;
$$;

revoke all on function public.accept_processor_offer(uuid) from public, anon, authenticated, service_role;
grant execute on function public.accept_processor_offer(uuid) to authenticated;

create or replace function public.validate_order_for_matching(p_order_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  order_record public.orders%rowtype;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and status = 'active' and role in ('super_admin','dispatcher')) then
    raise exception 'Dispatcher access required';
  end if;
  select * into order_record from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if order_record.status <> 'created' and not (order_record.status = 'validated' and order_record.validation_state = 'manual_review') then
    raise exception 'This order is no longer awaiting validation';
  end if;
  if order_record.customer_account_id is null
     or nullif(trim(order_record.customer_name), '') is null
     or nullif(trim(order_record.phone), '') is null
     or nullif(trim(order_record.pickup_address), '') is null
     or nullif(trim(order_record.customer_delivery_address), '') is null
     or nullif(trim(order_record.service_type), '') is null
     or order_record.expected_bags <= 0
     or order_record.due_at is null
     or order_record.pickup_window_start_at is null
     or order_record.pickup_window_end_at is null
     or order_record.delivery_window_start_at is null
     or order_record.delivery_window_end_at is null then
    raise exception 'Complete the CRM account, addresses, services, bag count, and pickup/delivery windows before validation';
  end if;
  if order_record.pickup_window_end_at <= order_record.pickup_window_start_at
     or order_record.delivery_window_start_at <= order_record.pickup_window_end_at
     or order_record.delivery_window_end_at <= order_record.delivery_window_start_at
     or order_record.due_at is distinct from order_record.delivery_window_end_at then
    raise exception 'Correct the pickup, delivery, and committed deadline schedule before validation';
  end if;
  update public.orders set status = 'validated', validation_state = 'resolved', validation_reason = null,
    validated_at = now(), validated_by = auth.uid(), updated_at = now()
    where id = p_order_id;
  insert into public.order_events (order_id, from_status, to_status, actor_id, note)
    values (p_order_id, order_record.status, 'validated', auth.uid(), 'Dispatcher validated the order. Processor ranking requires a separate selection.');
  return p_order_id;
end;
$$;

revoke all on function public.validate_order_for_matching(uuid) from public, anon, authenticated, service_role;
grant execute on function public.validate_order_for_matching(uuid) to authenticated;

create or replace function public.reorder_route_plan(p_plan_id uuid, p_stop_ids uuid[], p_mapbox_route jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  plan_status text;
  stop_id uuid;
  stop_index integer;
  expected_count integer;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and status = 'active' and role in ('super_admin','dispatcher')) then
    raise exception 'Dispatcher access required';
  end if;
  select status into plan_status from public.route_plans where id = p_plan_id for update;
  if not found then raise exception 'Route plan not found'; end if;
  if plan_status <> 'draft' then raise exception 'Only draft routes can be reordered'; end if;
  select count(*) into expected_count from public.route_stops where route_id = p_plan_id;
  if expected_count <> coalesce(cardinality(p_stop_ids), 0)
     or exists (select 1 from unnest(p_stop_ids) requested(requested_id) where not exists (select 1 from public.route_stops where id = requested.requested_id and route_id = p_plan_id))
     or (select count(distinct requested.requested_id) from unnest(p_stop_ids) requested(requested_id)) <> expected_count then
    raise exception 'Route stops no longer match this draft';
  end if;
  if exists (
    select 1 from public.route_stops dependent
    join public.route_stops prerequisite on prerequisite.route_id = dependent.route_id and prerequisite.order_id = dependent.order_id
      and prerequisite.route_type = case dependent.route_type when 'processor_dropoff' then 'pickup' when 'delivery' then 'processor_pickup' end
    where dependent.route_id = p_plan_id
      and dependent.route_type in ('processor_dropoff','delivery')
      and array_position(p_stop_ids, prerequisite.id) > array_position(p_stop_ids, dependent.id)
  ) then raise exception 'A dependent route stop cannot come before its pickup'; end if;
  for stop_index in 1..cardinality(p_stop_ids) loop
    stop_id := p_stop_ids[stop_index];
    update public.route_stops set sequence = -stop_index where id = stop_id and route_id = p_plan_id;
  end loop;
  for stop_index in 1..cardinality(p_stop_ids) loop
    stop_id := p_stop_ids[stop_index];
    update public.route_stops set sequence = stop_index where id = stop_id and route_id = p_plan_id;
  end loop;
  update public.route_plans set mapbox_route = p_mapbox_route where id = p_plan_id;
  return p_plan_id;
end;
$$;

revoke all on function public.reorder_route_plan(uuid, uuid[], jsonb) from public, anon, authenticated, service_role;
grant execute on function public.reorder_route_plan(uuid, uuid[], jsonb) to authenticated;

-- Create the order and all selected services in one transaction. This avoids a
-- partial order if a service row fails while a dispatcher is submitting intake.
create or replace function public.create_dispatch_order(p_order jsonb, p_services text[])
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  new_order_id uuid;
  selected_account_id uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and status = 'active' and role in ('super_admin','dispatcher')) then
    raise exception 'Only dispatch staff can create orders';
  end if;
  if coalesce(cardinality(p_services), 0) = 0 or cardinality(p_services) > 12
     or exists (select 1 from unnest(p_services) service where nullif(trim(service), '') is null)
     or cardinality(p_services) <> (select count(distinct lower(trim(service))) from unnest(p_services) service) then
    raise exception 'Choose between 1 and 12 unique services';
  end if;
  selected_account_id := (p_order->>'customer_account_id')::uuid;
  if not exists (select 1 from public.customer_accounts where id = selected_account_id and active) then
    raise exception 'Choose an active CRM account';
  end if;

  insert into public.orders (
    customer_account_id, customer_name, phone, pickup_address, pickup_latitude, pickup_longitude,
    customer_delivery_address, delivery_latitude, delivery_longitude, service_type, expected_bags,
    due_at_label, due_at, original_due_at, pickup_window_start_at, pickup_window_end_at,
    delivery_window_start_at, delivery_window_end_at, notes, item_description, textile_types,
    special_handling, customer_specifications, priority, validation_state, validated_at,
    validated_by, status, customer_user_id
  ) values (
    selected_account_id, p_order->>'customer_name', p_order->>'phone', p_order->>'pickup_address',
    null, null, p_order->>'delivery_address', null, null, array_to_string(p_services, ', '),
    (p_order->>'expected_bags')::integer, p_order->>'due_at_label', (p_order->>'due_at')::timestamptz,
    (p_order->>'due_at')::timestamptz, (p_order->>'pickup_window_start_at')::timestamptz,
    (p_order->>'pickup_window_end_at')::timestamptz, (p_order->>'delivery_window_start_at')::timestamptz,
    (p_order->>'delivery_window_end_at')::timestamptz, nullif(p_order->>'notes', ''),
    nullif(p_order->>'item_description', ''),
    array(select jsonb_array_elements_text(coalesce(p_order->'textile_types', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(p_order->'special_handling', '[]'::jsonb))),
    nullif(p_order->>'customer_specifications', ''),
    coalesce(nullif(p_order->>'priority', ''), 'standard')::public.order_priority,
    'manual_review', null, null, 'created', null
  ) returning id into new_order_id;

  return new_order_id;
end;
$$;

revoke all on function public.create_dispatch_order(jsonb, text[]) from public, anon, authenticated, service_role;
grant execute on function public.create_dispatch_order(jsonb, text[]) to authenticated;

-- A paired route can contain the same order twice. Use the specific stop ID
-- whenever the driver reports a failed stop so the wrong handoff cannot be
-- failed simply because it is the most recent route for that order.
drop function if exists public.fail_route_stop(uuid, text);
create or replace function public.fail_route_stop(p_order_id uuid, p_reason text, p_stop_id uuid default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  stop_record record;
  order_record public.orders%rowtype;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'driver' and status = 'active') then raise exception 'Driver access required'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'A failure reason is required'; end if;
  select route_stop.id, route_stop.route_id into stop_record
  from public.route_stops route_stop
  join public.route_plans route_plan on route_plan.id = route_stop.route_id
  where route_stop.order_id = p_order_id
    and route_stop.driver_id = auth.uid()
    and (p_stop_id is null or route_stop.id = p_stop_id)
    and route_stop.status in ('planned','arrived')
    and route_plan.status in ('approved','in_progress')
  order by route_stop.route_date desc
  limit 1 for update of route_stop, route_plan;
  if not found then raise exception 'This route stop is not assigned to the active driver'; end if;
  select * into order_record from public.orders where id = p_order_id and assigned_driver_id = auth.uid() for update;
  if not found then raise exception 'This order is not assigned to the active driver'; end if;

  update public.route_stops set status = 'failed', failure_reason = trim(p_reason) where id = stop_record.id;
  update public.route_plans set status = 'failed' where id = stop_record.route_id;
  update public.orders set has_exception = true, updated_at = now() where id = p_order_id;
  insert into public.order_events (order_id, from_status, to_status, actor_id, note)
    values (p_order_id, order_record.status, order_record.status, auth.uid(), 'Driver reported failed route stop: ' || trim(p_reason));
  insert into public.exceptions (order_id, type, stage, issue_code, description, severity, evidence_required, deadline_impact, deadline_before, opened_by, status)
    values (p_order_id, 'route_issue', 'route', 'failed_stop', trim(p_reason), 'high', false, case when order_record.due_at is null then 'none' else 'at_risk' end, order_record.due_at, auth.uid(), 'open');
  return stop_record.id;
end;
$$;

revoke all on function public.fail_route_stop(uuid, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.fail_route_stop(uuid, text, uuid) to authenticated;

-- Handoff photos are optional evidence. Count discrepancies still require a
-- written note and remain protected by assignment, stage, and route checks.
create or replace function public.protect_handoff_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  order_record public.orders%rowtype;
  expected_status public.order_status;
  required_route_type text;
  expected_handoff_bags integer;
begin
  if auth.uid() is null then return new; end if;
  select * into actor from public.profiles where id = auth.uid() and status = 'active';
  if not found then raise exception 'Active account required'; end if;
  if actor.role in ('super_admin','dispatcher') then return new; end if;
  if actor.role <> 'driver' then raise exception 'Driver access required'; end if;
  select * into order_record from public.orders where id = new.order_id;
  if not found or order_record.assigned_driver_id is distinct from actor.id then raise exception 'Order is not assigned to this driver'; end if;
  expected_status := case new.stage when 'customer_pickup' then 'pickup_scheduled' when 'processor_dropoff' then 'picked_up' when 'processor_pickup' then 'ready_for_pickup' when 'customer_delivery' then 'out_for_delivery' end;
  required_route_type := case new.stage when 'customer_pickup' then 'pickup' when 'processor_dropoff' then 'processor_dropoff' when 'processor_pickup' then 'processor_pickup' when 'customer_delivery' then 'delivery' end;
  if order_record.status <> expected_status then raise exception 'Handoff is not available at the current order stage'; end if;
  if new.confirmed_by is distinct from actor.id then raise exception 'Handoff confirmer must be the active driver'; end if;
  expected_handoff_bags := case new.stage
    when 'customer_pickup' then order_record.expected_bags
    when 'processor_dropoff' then coalesce(order_record.actual_bags, order_record.expected_bags)
    when 'processor_pickup' then coalesce(order_record.processor_bags, order_record.actual_bags, order_record.expected_bags)
    when 'customer_delivery' then coalesce(order_record.completed_bags, order_record.processor_bags, order_record.actual_bags, order_record.expected_bags)
  end;
  if new.expected_bags <> expected_handoff_bags then raise exception 'Expected handoff count does not match the preceding handoff'; end if;
  if new.actual_bags <> new.expected_bags and nullif(trim(new.discrepancy), '') is null then
    raise exception 'Add a discrepancy note when the recorded count differs from expected';
  end if;
  if not exists (
    select 1 from public.route_stops route_stop join public.route_plans route_plan on route_plan.id = route_stop.route_id
    where route_stop.order_id = new.order_id and route_stop.driver_id = actor.id and route_stop.route_type = required_route_type
      and route_stop.status in ('planned','arrived') and route_plan.status in ('approved','in_progress')
  ) then raise exception 'No active assigned route stop exists for this handoff'; end if;
  return new;
end;
$$;
