-- Require photo evidence for every physical driver handoff. QC and release
-- transitions do not create handoffs and intentionally remain photo-free.
create or replace function public.protect_handoff_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  order_record public.orders%rowtype;
  expected_status public.order_status;
  required_route_type text;
  required_photo_kind text;
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
  required_photo_kind := replace(new.stage, '_', '-');
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
  if not exists (
    select 1 from public.order_photos
    where order_id = new.order_id and kind = required_photo_kind
  ) then raise exception 'Upload the required handoff photo first'; end if;
  return new;
end;
$$;
