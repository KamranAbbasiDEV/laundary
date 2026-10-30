-- Keep exhausted processor matching visible to dispatch instead of leaving an
-- order permanently in processor_ranked with no pending offer.

create or replace function public.reject_processor_offer(p_offer_id uuid, p_reason text default 'Processor declined')
returns table (offer_id uuid, order_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  selected_offer public.processor_offers%rowtype;
  next_offer_id uuid;
begin
  select * into selected_offer from public.processor_offers where public.processor_offers.id = p_offer_id for update;
  if not found then raise exception 'Processor offer not found'; end if;
  if selected_offer.status <> 'pending' or (selected_offer.expires_at is not null and selected_offer.expires_at <= now()) then raise exception 'This processor offer is no longer available'; end if;
  if not exists (select 1 from public.profiles where public.profiles.id = auth.uid() and role = 'processor' and status = 'active' and processor_id = selected_offer.processor_id) then raise exception 'Processor access required'; end if;

  update public.processor_offers set status = 'rejected', rejection_reason = coalesce(nullif(trim(p_reason), ''), 'Processor declined'), responded_by = auth.uid(), responded_at = now() where id = selected_offer.id;
  select id into next_offer_id from public.processor_offers where public.processor_offers.order_id = selected_offer.order_id and status = 'withdrawn' and rank > selected_offer.rank order by rank limit 1 for update;
  if next_offer_id is not null then
    update public.processor_offers set status = 'pending', offered_at = now(), expires_at = now() + interval '4 hours' where id = next_offer_id;
    insert into public.notification_log (order_id, recipient, channel, event, message, status, sent_at)
      select selected_offer.order_id, 'processor:' || offer.processor_id::text, 'in_app', 'processor_offer', 'New RinseLine capacity request for ' || order_record.order_number || '.', 'sent', now()
      from public.processor_offers offer join public.orders order_record on order_record.id = offer.order_id
      where offer.id = next_offer_id;
  else
    update public.orders set status = 'validated', validation_state = 'manual_review', validation_reason = 'All eligible processors declined or expired. Dispatcher reassignment is required.', updated_at = now() where id = selected_offer.order_id and status = 'processor_ranked';
  end if;
  return query select selected_offer.id, selected_offer.order_id;
end;
$$;

revoke all on function public.reject_processor_offer(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.reject_processor_offer(uuid, text) to authenticated;

create or replace function public.advance_expired_processor_offers()
returns table (order_id uuid, offer_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  expired_offer public.processor_offers%rowtype;
  next_offer public.processor_offers%rowtype;
begin
  for expired_offer in
    select offer.* from public.processor_offers offer join public.orders order_record on order_record.id = offer.order_id
    where offer.status = 'pending' and offer.expires_at is not null and offer.expires_at <= now() and order_record.status = 'processor_ranked'
    order by offer.expires_at for update of offer skip locked
  loop
    update public.processor_offers set status = 'expired', responded_at = now() where id = expired_offer.id;
    select * into next_offer from public.processor_offers where public.processor_offers.order_id = expired_offer.order_id and status = 'withdrawn' and rank > expired_offer.rank order by rank limit 1 for update;
    if found then
      update public.processor_offers set status = 'pending', offered_at = now(), expires_at = now() + interval '4 hours' where id = next_offer.id;
      order_id := expired_offer.order_id;
      offer_id := next_offer.id;
      return next;
    else
      update public.orders set status = 'validated', validation_state = 'manual_review', validation_reason = 'All eligible processor offers expired. Dispatcher reassignment is required.', updated_at = now() where id = expired_offer.order_id and status = 'processor_ranked';
    end if;
  end loop;
end;
$$;

revoke all on function public.advance_expired_processor_offers() from public, anon, authenticated, service_role;
grant execute on function public.advance_expired_processor_offers() to service_role;

-- Finish a physical driver handoff, its order transition and its route stop in
-- one transaction. The handoff/photo are recorded first and remain retryable.
create or replace function public.advance_driver_order_stage(p_order_id uuid, p_target_status public.order_status)
returns table (order_id uuid, route_stop_id uuid, route_plan_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  order_record public.orders%rowtype;
  stop_record public.route_stops%rowtype;
  expected_status public.order_status;
  required_stage text;
  required_route_type text;
begin
  select * into order_record from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'driver' and status = 'active'
      and id = order_record.assigned_driver_id
  ) then raise exception 'This order is not assigned to the active driver'; end if;

  case p_target_status
    when 'picked_up' then expected_status := 'pickup_scheduled'; required_stage := 'customer_pickup'; required_route_type := 'pickup';
    when 'at_processor' then expected_status := 'picked_up'; required_stage := 'processor_dropoff'; required_route_type := 'processor_dropoff';
    when 'picked_up_from_processor' then expected_status := 'ready_for_pickup'; required_stage := 'processor_pickup'; required_route_type := 'processor_pickup';
    when 'delivered' then expected_status := 'out_for_delivery'; required_stage := 'customer_delivery'; required_route_type := 'delivery';
    else raise exception 'This transition is not a physical driver handoff';
  end case;

  if order_record.status <> expected_status then
    raise exception 'Order is no longer at the expected handoff stage';
  end if;
  if not exists (select 1 from public.order_handoffs where public.order_handoffs.order_id = p_order_id and stage = required_stage) then
    raise exception 'Record the required handoff before advancing this order';
  end if;

  select route_stop.* into stop_record
  from public.route_stops route_stop
  join public.route_plans route_plan on route_plan.id = route_stop.route_id
  where route_stop.order_id = p_order_id
    and route_stop.driver_id = auth.uid()
    and route_stop.route_type = required_route_type
    and route_stop.status in ('planned', 'arrived')
    and route_plan.status in ('approved', 'in_progress')
  order by route_stop.route_date desc, route_stop.sequence
  limit 1 for update of route_stop;
  if not found then raise exception 'No active assigned route stop exists for this handoff'; end if;

  update public.orders set status = p_target_status, updated_at = now() where id = p_order_id;
  update public.route_stops set status = 'completed', completed_at = now(), completed_by = auth.uid() where id = stop_record.id;
  if not exists (
    select 1 from public.route_stops
    where route_id = stop_record.route_id and status not in ('completed', 'skipped')
  ) then
    update public.route_plans set status = 'complete' where id = stop_record.route_id and status in ('approved', 'in_progress');
  end if;

  return query select p_order_id, stop_record.id, stop_record.route_id;
end;
$$;

revoke all on function public.advance_driver_order_stage(uuid, public.order_status) from public, anon, authenticated, service_role;
grant execute on function public.advance_driver_order_stage(uuid, public.order_status) to authenticated;

-- Approve a route and assign every affected order/stop as one transaction.
create or replace function public.approve_route_plan(p_plan_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  plan_record public.route_plans%rowtype;
  stop_record record;
  required_status public.order_status;
  next_status public.order_status;
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

  required_status := case plan_record.route_type
    when 'pickup' then 'capacity_confirmed'
    when 'processor_dropoff' then 'picked_up'
    when 'processor_pickup' then 'ready_for_pickup'
    when 'delivery' then 'out_for_delivery'
    else null
  end;
  if required_status is null then raise exception 'Unsupported route type'; end if;
  next_status := case when plan_record.route_type = 'pickup' then 'pickup_scheduled' else required_status end;

  for stop_record in
    select route_stop.id as stop_id, route_stop.order_id, order_record.status, order_record.order_number
    from public.route_stops route_stop
    join public.orders order_record on order_record.id = route_stop.order_id
    where route_stop.route_id = plan_record.id and route_stop.status <> 'completed'
    order by route_stop.sequence
    for update of route_stop, order_record
  loop
    pending_count := pending_count + 1;
    if plan_record.route_type = 'pickup' then
      if stop_record.status not in ('capacity_confirmed', 'pickup_scheduled') then
        raise exception 'Order % is no longer eligible for this route', stop_record.order_number;
      end if;
    elsif stop_record.status <> required_status then
      raise exception 'Order % is no longer eligible for this route', stop_record.order_number;
    end if;
    update public.orders
      set assigned_driver_id = plan_record.driver_id,
          status = next_status,
          updated_at = now()
      where id = stop_record.order_id;
    update public.route_stops set driver_id = plan_record.driver_id where id = stop_record.stop_id;
    insert into public.order_events (order_id, from_status, to_status, actor_id, note)
      values (stop_record.order_id, stop_record.status, next_status, auth.uid(), 'Route approved for ' || replace(plan_record.route_type, '_', ' ') || '.');
  end loop;
  if pending_count = 0 then raise exception 'This route has no pending stops and cannot be approved'; end if;

  update public.route_plans
    set status = 'approved', approved_by = auth.uid(), approved_at = now()
    where id = plan_record.id;
  return plan_record.id;
end;
$$;

revoke all on function public.approve_route_plan(uuid) from public, anon, authenticated, service_role;
grant execute on function public.approve_route_plan(uuid) to authenticated;

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
     or exists (select 1 from unnest(p_stop_ids) as requested(requested_id) where not exists (select 1 from public.route_stops where id = requested.requested_id and route_id = p_plan_id))
     or (select count(distinct requested.requested_id) from unnest(p_stop_ids) as requested(requested_id)) <> expected_count then
    raise exception 'Route stops no longer match this draft';
  end if;
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

create or replace function public.recover_route_plan(p_plan_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  plan_status text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and status = 'active' and role in ('super_admin','dispatcher')) then
    raise exception 'Dispatcher access required';
  end if;
  select status into plan_status from public.route_plans where id = p_plan_id for update;
  if not found then raise exception 'Route plan not found'; end if;
  if plan_status <> 'failed' then raise exception 'Only failed routes can be reopened'; end if;
  update public.route_stops set status = 'planned', failure_reason = null, checked_in_at = null where route_id = p_plan_id and status = 'failed';
  update public.route_plans set status = 'draft', approved_at = null, approved_by = null where id = p_plan_id;
  return p_plan_id;
end;
$$;

revoke all on function public.reorder_route_plan(uuid, uuid[], jsonb) from public, anon, authenticated, service_role;
revoke all on function public.recover_route_plan(uuid) from public, anon, authenticated, service_role;
grant execute on function public.reorder_route_plan(uuid, uuid[], jsonb) to authenticated;
grant execute on function public.recover_route_plan(uuid) to authenticated;

create or replace function public.create_route_plan(
  p_route_date date,
  p_route_type text,
  p_order_ids uuid[],
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
  required_status public.order_status;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and status = 'active' and role in ('super_admin','dispatcher')) then
    raise exception 'Dispatcher access required';
  end if;
  if p_route_type not in ('pickup','processor_dropoff','processor_pickup','delivery') then raise exception 'Unsupported route type'; end if;
  if not exists (select 1 from public.profiles where id = p_driver_id and role = 'driver' and status = 'active') then raise exception 'Select an active driver'; end if;
  if coalesce(cardinality(p_order_ids), 0) = 0
     or cardinality(p_order_ids) <> cardinality(p_longitudes)
     or cardinality(p_order_ids) <> cardinality(p_latitudes)
     or (select count(distinct requested.order_id) from unnest(p_order_ids) as requested(order_id)) <> cardinality(p_order_ids) then
    raise exception 'Route orders and coordinates are invalid';
  end if;
  perform 1 from public.orders where id = any(p_order_ids) for update;
  if (select count(*) from public.orders where id = any(p_order_ids)) <> cardinality(p_order_ids) then raise exception 'One or more route orders could not be found'; end if;
  required_status := case p_route_type
    when 'pickup' then 'capacity_confirmed'
    when 'processor_dropoff' then 'picked_up'
    when 'processor_pickup' then 'ready_for_pickup'
    when 'delivery' then 'out_for_delivery'
  end;
  if exists (select 1 from public.orders where id = any(p_order_ids) and status <> required_status) then raise exception 'One or more orders are no longer eligible for this route'; end if;
  if exists (
    select 1 from public.route_stops route_stop
    join public.route_plans route_plan on route_plan.id = route_stop.route_id
    where route_stop.order_id = any(p_order_ids)
      and route_plan.route_type = p_route_type
      and route_plan.status in ('draft','approved','in_progress','failed')
  ) then raise exception 'One or more orders already belong to an open route of this type'; end if;

  insert into public.route_plans (route_date, route_type, driver_id, status, mapbox_route, created_by)
    values (p_route_date, p_route_type, p_driver_id, 'draft', p_mapbox_route, auth.uid())
    returning id into new_plan_id;
  for item_index in 1..cardinality(p_order_ids) loop
    insert into public.route_stops (route_id, route_date, route_type, order_id, sequence, longitude, latitude)
      values (new_plan_id, p_route_date, p_route_type, p_order_ids[item_index], item_index, p_longitudes[item_index], p_latitudes[item_index]);
  end loop;
  return new_plan_id;
end;
$$;

revoke all on function public.create_route_plan(date, text, uuid[], uuid, jsonb, double precision[], double precision[]) from public, anon, authenticated, service_role;
grant execute on function public.create_route_plan(date, text, uuid[], uuid, jsonb, double precision[], double precision[]) to authenticated;

create or replace function public.check_in_route_stop(p_order_id uuid, p_stop_id uuid default null)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  stop_record record;
  check_in_time timestamptz;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'driver' and status = 'active') then raise exception 'Driver access required'; end if;
  select route_stop.id, route_stop.route_id, route_stop.checked_in_at into stop_record
  from public.route_stops route_stop
  join public.route_plans route_plan on route_plan.id = route_stop.route_id
  where route_stop.order_id = p_order_id
    and route_stop.driver_id = auth.uid()
    and (p_stop_id is null or route_stop.id = p_stop_id)
    and route_stop.status in ('planned','arrived')
    and route_plan.status in ('approved','in_progress')
  order by route_stop.route_date desc
  limit 1 for update of route_stop, route_plan;
  if not found then raise exception 'This order is not assigned to an active route'; end if;
  if stop_record.checked_in_at is not null then return stop_record.checked_in_at; end if;
  check_in_time := now();
  update public.route_stops set checked_in_at = check_in_time, status = 'arrived' where id = stop_record.id;
  update public.route_plans set status = 'in_progress' where id = stop_record.route_id and status = 'approved';
  return check_in_time;
end;
$$;

create or replace function public.fail_route_stop(p_order_id uuid, p_reason text)
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
    and route_stop.status in ('planned','arrived')
    and route_plan.status in ('approved','in_progress')
  order by route_stop.route_date desc
  limit 1 for update of route_stop, route_plan;
  if not found then raise exception 'This order is not assigned to an active route'; end if;
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

revoke all on function public.check_in_route_stop(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.fail_route_stop(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.check_in_route_stop(uuid, uuid) to authenticated;
grant execute on function public.fail_route_stop(uuid, text) to authenticated;

create or replace function public.finalize_order_validation(p_order_id uuid, p_candidates jsonb, p_no_match_reason text default null)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  order_record public.orders%rowtype;
  candidate jsonb;
  candidate_count integer;
  candidate_rank integer := 0;
  candidate_id uuid;
  next_status public.order_status;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and status = 'active' and role in ('super_admin','dispatcher')) then raise exception 'Dispatcher access required'; end if;
  select * into order_record from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if order_record.status not in ('created','validated') then raise exception 'This order is no longer awaiting validation'; end if;
  if p_candidates is null or jsonb_typeof(p_candidates) <> 'array' then raise exception 'Processor candidates must be an array'; end if;
  candidate_count := jsonb_array_length(p_candidates);
  delete from public.processor_offers where order_id = p_order_id;

  for candidate in select value from jsonb_array_elements(p_candidates) loop
    candidate_rank := candidate_rank + 1;
    candidate_id := (candidate->>'id')::uuid;
    if not exists (select 1 from public.processors where id = candidate_id and active = true) then raise exception 'A selected processor is no longer active'; end if;
    insert into public.processor_offers (order_id, processor_id, rank, score, score_breakdown, expires_at, status)
      values (p_order_id, candidate_id, candidate_rank, coalesce((candidate->>'score')::numeric, 0), coalesce(candidate->'breakdown', '{}'::jsonb), now() + interval '4 hours', case when candidate_rank = 1 then 'pending' else 'withdrawn' end);
    if candidate_rank = 1 then
      insert into public.notification_log (order_id, recipient, channel, event, message, status, sent_at)
        values (p_order_id, 'processor:' || candidate_id::text, 'in_app', 'processor_offer', 'New RinseLine capacity request for ' || order_record.order_number || '.', 'sent', now());
    end if;
  end loop;

  next_status := case when candidate_count > 0 then 'processor_ranked' else 'validated' end;
  update public.orders set
    status = next_status,
    validation_state = case when candidate_count > 0 then 'resolved' else 'manual_review' end,
    validation_reason = case when candidate_count > 0 then null else coalesce(nullif(trim(p_no_match_reason), ''), 'No eligible processor is currently available. Dispatcher review is required.') end,
    validated_at = now(), validated_by = auth.uid(), updated_at = now()
  where id = p_order_id;
  insert into public.order_events (order_id, from_status, to_status, actor_id, note)
    values (p_order_id, order_record.status, next_status, auth.uid(), case when candidate_count > 0 then 'Dispatcher validation approved and processor matching started.' else 'Dispatcher validation approved; manual processor review required.' end);
  return candidate_count;
end;
$$;

revoke all on function public.finalize_order_validation(uuid, jsonb, text) from public, anon, authenticated, service_role;
grant execute on function public.finalize_order_validation(uuid, jsonb, text) to authenticated;

-- Enforce the same assignment boundaries at the database layer as the API.
-- This prevents a valid driver/processor session from bypassing API checks by
-- writing directly through the public Supabase client.
create or replace function public.is_dispatch_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active' and role in ('super_admin', 'dispatcher')
  )
$$;

create or replace function public.can_access_order(p_order_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.orders order_record
    join public.profiles profile on profile.id = auth.uid() and profile.status = 'active'
    where order_record.id = p_order_id
      and (
        profile.role in ('super_admin', 'dispatcher')
        or (profile.role = 'customer' and order_record.customer_user_id = profile.id)
        or (profile.role = 'driver' and order_record.assigned_driver_id = profile.id)
        or (
          profile.role = 'processor'
          and profile.processor_id is not null
          and (
            order_record.processor_id = profile.processor_id
            or exists (
              select 1 from public.processor_offers offer
              where offer.order_id = order_record.id and offer.processor_id = profile.processor_id
            )
          )
        )
      )
  )
$$;

create or replace function public.can_operate_order(p_order_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.orders order_record
    join public.profiles profile on profile.id = auth.uid() and profile.status = 'active'
    where order_record.id = p_order_id
      and (
        profile.role in ('super_admin', 'dispatcher')
        or (profile.role = 'driver' and order_record.assigned_driver_id = profile.id)
        or (profile.role = 'processor' and profile.processor_id is not null and order_record.processor_id = profile.processor_id)
      )
  )
$$;

revoke all on function public.is_dispatch_admin() from public, anon;
revoke all on function public.can_access_order(uuid) from public, anon;
revoke all on function public.can_operate_order(uuid) from public, anon;
grant execute on function public.is_dispatch_admin() to authenticated, service_role;
grant execute on function public.can_access_order(uuid) to authenticated, service_role;
grant execute on function public.can_operate_order(uuid) to authenticated, service_role;

drop policy if exists "users can read their own profile" on public.profiles;
create policy "users can read their own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.is_dispatch_admin());

drop policy if exists "operations read settings" on public.workspace_settings;
create policy "operations read settings" on public.workspace_settings for select to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and status = 'active')
);

drop policy if exists "authorized users can read orders" on public.orders;
drop policy if exists "customers and dispatch can create orders" on public.orders;
drop policy if exists "operations can update orders" on public.orders;
drop policy if exists "super admins delete orders" on public.orders;
create policy "authorized users can read orders" on public.orders for select to authenticated using (public.can_access_order(id));
create policy "customers and dispatch can create orders" on public.orders for insert to authenticated with check (
  public.is_dispatch_admin()
  or (customer_user_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and role = 'customer' and status = 'active'))
);
create policy "operations can update orders" on public.orders for update to authenticated using (public.can_operate_order(id)) with check (public.can_operate_order(id));
create policy "super admins delete orders" on public.orders for delete to authenticated using (public.is_super_admin());

drop policy if exists "operations can read processors" on public.processors;
create policy "operations can read processors" on public.processors for select to authenticated using (
  public.is_dispatch_admin()
  or exists (select 1 from public.profiles where id = auth.uid() and status = 'active' and role = 'processor' and processor_id = public.processors.id)
  or exists (select 1 from public.orders where assigned_driver_id = auth.uid() and processor_id = public.processors.id)
);

drop policy if exists "drivers write own locations" on public.driver_location_events;
drop policy if exists "operations read driver locations" on public.driver_location_events;
create policy "drivers write own locations" on public.driver_location_events for insert to authenticated with check (
  driver_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and role = 'driver' and status = 'active')
);
create policy "operations read driver locations" on public.driver_location_events for select to authenticated using (
  public.is_dispatch_admin() or (driver_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and role = 'driver' and status = 'active'))
);

drop policy if exists "operations read deadline revisions" on public.deadline_revisions;
drop policy if exists "operations create deadline revisions" on public.deadline_revisions;
create policy "operations read deadline revisions" on public.deadline_revisions for select to authenticated using (public.is_dispatch_admin());
create policy "operations create deadline revisions" on public.deadline_revisions for insert to authenticated with check (public.is_dispatch_admin());

drop policy if exists "authorized users can read events" on public.order_events;
drop policy if exists "operations can create events" on public.order_events;
create policy "authorized users can read events" on public.order_events for select to authenticated using (public.can_access_order(order_id));
create policy "operations can create events" on public.order_events for insert to authenticated with check (public.can_operate_order(order_id));

drop policy if exists "operations can manage exceptions" on public.exceptions;
create policy "authorized users can read exceptions" on public.exceptions for select to authenticated using (public.can_access_order(order_id));
create policy "assigned operations can create exceptions" on public.exceptions for insert to authenticated with check (public.can_operate_order(order_id));
create policy "assigned operations can update exceptions" on public.exceptions for update to authenticated using (
  public.is_dispatch_admin() or (opened_by = auth.uid() and source_handoff_id is not null and public.can_operate_order(order_id))
) with check (
  public.is_dispatch_admin() or (opened_by = auth.uid() and source_handoff_id is not null and public.can_operate_order(order_id) and status = 'open' and resolved_at is null and resolved_by is null)
);
create policy "dispatch can delete exceptions" on public.exceptions for delete to authenticated using (public.is_dispatch_admin());

drop policy if exists "operations can manage routes" on public.route_stops;
create policy "dispatch and assigned drivers read route stops" on public.route_stops for select to authenticated using (public.is_dispatch_admin() or driver_id = auth.uid());
create policy "dispatch creates route stops" on public.route_stops for insert to authenticated with check (public.is_dispatch_admin());
create policy "dispatch and assigned drivers update route stops" on public.route_stops for update to authenticated using (public.is_dispatch_admin()) with check (public.is_dispatch_admin());
create policy "dispatch deletes route stops" on public.route_stops for delete to authenticated using (public.is_dispatch_admin());

drop policy if exists "operations manage route plans" on public.route_plans;
create policy "dispatch and assigned drivers read route plans" on public.route_plans for select to authenticated using (public.is_dispatch_admin() or driver_id = auth.uid());
create policy "dispatch creates route plans" on public.route_plans for insert to authenticated with check (public.is_dispatch_admin());
create policy "dispatch and assigned drivers update route plans" on public.route_plans for update to authenticated using (public.is_dispatch_admin()) with check (public.is_dispatch_admin());
create policy "dispatch deletes route plans" on public.route_plans for delete to authenticated using (public.is_dispatch_admin());

drop policy if exists "operations manage handoffs" on public.order_handoffs;
drop policy if exists "customers read own handoffs" on public.order_handoffs;
create policy "authorized users read handoffs" on public.order_handoffs for select to authenticated using (public.can_access_order(order_id));
create policy "dispatch and assigned drivers create handoffs" on public.order_handoffs for insert to authenticated with check (
  public.is_dispatch_admin() or exists (select 1 from public.orders where id = order_id and assigned_driver_id = auth.uid())
);
create policy "dispatch and assigned drivers update handoffs" on public.order_handoffs for update to authenticated using (
  public.is_dispatch_admin() or exists (select 1 from public.orders where id = order_id and assigned_driver_id = auth.uid())
) with check (
  public.is_dispatch_admin() or exists (select 1 from public.orders where id = order_id and assigned_driver_id = auth.uid())
);
create policy "dispatch deletes handoffs" on public.order_handoffs for delete to authenticated using (public.is_dispatch_admin());

drop policy if exists "operations read processor offers" on public.processor_offers;
drop policy if exists "operations manage processor offers" on public.processor_offers;
drop policy if exists "processors respond to offers" on public.processor_offers;
create policy "dispatch and assigned processors read offers" on public.processor_offers for select to authenticated using (
  public.is_dispatch_admin()
  or exists (select 1 from public.profiles where id = auth.uid() and status = 'active' and role = 'processor' and processor_id = public.processor_offers.processor_id)
);
create policy "dispatch manages processor offers" on public.processor_offers for all to authenticated using (public.is_dispatch_admin()) with check (public.is_dispatch_admin());

drop policy if exists "operations can manage photos" on public.order_photos;
create policy "assigned operations read order photos" on public.order_photos for select to authenticated using (public.can_operate_order(order_id));
create policy "assigned operations create order photos" on public.order_photos for insert to authenticated with check (public.can_operate_order(order_id));
drop policy if exists "operations can upload order photos" on storage.objects;
drop policy if exists "operations can read order photos" on storage.objects;
drop policy if exists "authenticated staff can upload order photos" on storage.objects;
drop policy if exists "authenticated staff can read order photos" on storage.objects;

create or replace function public.storage_order_id(p_name text)
returns uuid
language plpgsql immutable set search_path = ''
as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create policy "assigned operations upload order photos" on storage.objects for insert to authenticated with check (
  bucket_id = 'order-photos' and public.can_operate_order(public.storage_order_id(name))
);
create policy "assigned operations read order photo files" on storage.objects for select to authenticated using (
  bucket_id = 'order-photos' and public.can_operate_order(public.storage_order_id(name))
);
create policy "assigned operations remove failed photo uploads" on storage.objects for delete to authenticated using (
  bucket_id = 'order-photos' and public.can_operate_order(public.storage_order_id(name))
);

drop policy if exists "admins read notifications" on public.notification_log;
drop policy if exists "active users create scoped notifications" on public.notification_log;
create policy "authorized users read notifications" on public.notification_log for select to authenticated using (
  public.is_dispatch_admin()
  or (
    order_id is not null
    and public.can_access_order(order_id)
    and exists (
      select 1 from public.profiles profile
      where profile.id = auth.uid() and profile.status = 'active' and (
        (profile.role = 'customer' and recipient in ('customer', 'customer:' || profile.id::text))
        or (profile.role = 'driver' and recipient = 'operations')
        or (profile.role = 'processor' and recipient in ('operations', 'processor:' || coalesce(profile.processor_id::text, '')))
      )
    )
  )
);
create policy "active users create scoped notifications" on public.notification_log for insert to authenticated with check (
  order_id is not null
  and public.can_access_order(order_id)
  and exists (select 1 from public.profiles where id = auth.uid() and status = 'active')
);

drop policy if exists "operations manage payments" on public.payment_records;
drop policy if exists "customers read own payments" on public.payment_records;
create policy "operations manage payments" on public.payment_records for all to authenticated using (public.is_dispatch_admin()) with check (public.is_dispatch_admin());
create policy "customers read own payments" on public.payment_records for select to authenticated using (
  exists (select 1 from public.orders order_record where order_record.id = public.payment_records.order_id and order_record.customer_user_id = auth.uid())
);

drop policy if exists "operations read scorecards" on public.processor_scorecards;
drop policy if exists "admins manage scorecards" on public.processor_scorecards;
create policy "operations read scorecards" on public.processor_scorecards for select to authenticated using (
  public.is_dispatch_admin()
  or exists (select 1 from public.profiles where id = auth.uid() and status = 'active' and role = 'processor' and processor_id = public.processor_scorecards.processor_id)
);
create policy "admins manage scorecards" on public.processor_scorecards for all to authenticated using (public.is_dispatch_admin()) with check (public.is_dispatch_admin());

drop policy if exists "public can submit processor applications" on public.processor_applications;
drop policy if exists "admins can read processor applications" on public.processor_applications;
drop policy if exists "admins can update processor applications" on public.processor_applications;
create policy "public can submit processor applications" on public.processor_applications for insert to anon, authenticated with check (
  status = 'pending' and (applicant_user_id is null or applicant_user_id = auth.uid())
);
create policy "admins can read processor applications" on public.processor_applications for select to authenticated using (public.is_dispatch_admin());
create policy "admins can update processor applications" on public.processor_applications for update to authenticated using (public.is_dispatch_admin()) with check (public.is_dispatch_admin());

drop policy if exists "admins can read audit log" on public.audit_log;
drop policy if exists "super admins write audit log" on public.audit_log;
drop policy if exists "active users write own audit log" on public.audit_log;
create policy "admins can read audit log" on public.audit_log for select to authenticated using (public.is_dispatch_admin());
create policy "active users write own audit log" on public.audit_log for insert to authenticated with check (
  actor_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and status = 'active')
);

create or replace function public.protect_order_role_fields()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  active_stop record;
  required_route_type text;
begin
  if auth.uid() is null then return new; end if;
  select * into actor from public.profiles where id = auth.uid();
  if not found or actor.status <> 'active' then raise exception 'Active account required'; end if;
  if actor.role in ('super_admin', 'dispatcher') then return new; end if;

  if actor.role = 'driver' then
    if old.assigned_driver_id is distinct from actor.id then raise exception 'Order is not assigned to this driver'; end if;
    if (to_jsonb(new) - array['status','actual_bags','processor_bags','completed_bags','delivered_bags','has_exception','updated_at'])
       is distinct from
       (to_jsonb(old) - array['status','actual_bags','processor_bags','completed_bags','delivered_bags','has_exception','updated_at']) then
      raise exception 'Drivers may only record assigned workflow progress';
    end if;
    if old.has_exception and not new.has_exception then raise exception 'Only dispatch can clear an exception'; end if;
    if new.actual_bags is distinct from old.actual_bags and not exists (select 1 from public.order_handoffs where order_id = old.id and stage = 'customer_pickup' and actual_bags = new.actual_bags and confirmed_by = actor.id) then raise exception 'Customer pickup count must match its handoff'; end if;
    if new.processor_bags is distinct from old.processor_bags and not exists (select 1 from public.order_handoffs where order_id = old.id and stage = 'processor_dropoff' and actual_bags = new.processor_bags and confirmed_by = actor.id) then raise exception 'Processor drop-off count must match its handoff'; end if;
    if new.completed_bags is distinct from old.completed_bags and not exists (select 1 from public.order_handoffs where order_id = old.id and stage = 'processor_pickup' and actual_bags = new.completed_bags and confirmed_by = actor.id) then raise exception 'Processor pickup count must match its handoff'; end if;
    if new.delivered_bags is distinct from old.delivered_bags and not exists (select 1 from public.order_handoffs where order_id = old.id and stage = 'customer_delivery' and actual_bags = new.delivered_bags and confirmed_by = actor.id) then raise exception 'Delivery count must match its handoff'; end if;
    if new.status is distinct from old.status and not (
      (old.status = 'pickup_scheduled' and new.status = 'picked_up')
      or (old.status = 'picked_up' and new.status = 'at_processor')
      or (old.status = 'ready_for_pickup' and new.status = 'picked_up_from_processor')
      or (old.status = 'picked_up_from_processor' and new.status = 'qc_reconciliation')
      or (old.status = 'qc_reconciliation' and new.status = 'out_for_delivery')
      or (old.status = 'out_for_delivery' and new.status = 'delivered')
    ) then raise exception 'Invalid driver workflow transition'; end if;
    if new.status is distinct from old.status and (
      (new.status = 'picked_up' and not exists (select 1 from public.order_handoffs where order_id = old.id and stage = 'customer_pickup' and confirmed_by = actor.id))
      or (new.status = 'at_processor' and not exists (select 1 from public.order_handoffs where order_id = old.id and stage = 'processor_dropoff' and confirmed_by = actor.id))
      or (new.status = 'picked_up_from_processor' and not exists (select 1 from public.order_handoffs where order_id = old.id and stage = 'processor_pickup' and confirmed_by = actor.id))
      or (new.status = 'delivered' and not exists (select 1 from public.order_handoffs where order_id = old.id and stage = 'customer_delivery' and confirmed_by = actor.id))
    ) then raise exception 'Required handoff evidence is missing'; end if;
    if new.status is distinct from old.status and new.status in ('picked_up','at_processor','picked_up_from_processor','delivered') then
      required_route_type := case new.status when 'picked_up' then 'pickup' when 'at_processor' then 'processor_dropoff' when 'picked_up_from_processor' then 'processor_pickup' else 'delivery' end;
      select route_stop.id, route_stop.route_id into active_stop
      from public.route_stops route_stop
      join public.route_plans route_plan on route_plan.id = route_stop.route_id
      where route_stop.order_id = old.id and route_stop.driver_id = actor.id
        and route_stop.route_type = required_route_type
        and route_stop.status in ('planned','arrived')
        and route_plan.status in ('approved','in_progress')
      order by route_stop.route_date desc limit 1 for update of route_stop;
      if not found then raise exception 'No active assigned route stop exists for this handoff'; end if;
      update public.route_stops set status = 'completed', completed_at = now(), completed_by = actor.id where id = active_stop.id;
      if not exists (select 1 from public.route_stops where route_id = active_stop.route_id and status not in ('completed','skipped')) then
        update public.route_plans set status = 'complete' where id = active_stop.route_id and status in ('approved','in_progress');
      end if;
    end if;
    return new;
  end if;

  if actor.role = 'processor' then
    -- Capacity RPCs run as security-definer functions but retain the processor's
    -- auth.uid(). Permit only their exact, offer-backed order mutations.
    if old.status = 'processor_ranked' and new.status = 'capacity_confirmed'
       and new.processor_id = actor.processor_id
       and exists (
         select 1 from public.processor_offers
         where order_id = old.id and processor_id = actor.processor_id and status = 'pending'
       ) then
      if (to_jsonb(new) - array['status','processor_id','updated_at']) is distinct from (to_jsonb(old) - array['status','processor_id','updated_at']) then
        raise exception 'Capacity acceptance changed protected order fields';
      end if;
      return new;
    end if;
    if old.status = 'processor_ranked' and new.status = 'validated'
       and new.processor_id is null
       and exists (
         select 1 from public.processor_offers
         where order_id = old.id and processor_id = actor.processor_id and status in ('rejected','expired')
       )
       and not exists (select 1 from public.processor_offers where order_id = old.id and status = 'pending') then
      if (to_jsonb(new) - array['status','validation_state','validation_reason','updated_at']) is distinct from (to_jsonb(old) - array['status','validation_state','validation_reason','updated_at']) then
        raise exception 'Offer exhaustion changed protected order fields';
      end if;
      return new;
    end if;
    if actor.processor_id is null or old.processor_id is distinct from actor.processor_id then raise exception 'Order is not assigned to this processor'; end if;
    if (to_jsonb(new) - array['status','updated_at']) is distinct from (to_jsonb(old) - array['status','updated_at']) then
      raise exception 'Processors may only record processing progress';
    end if;
    if new.status is distinct from old.status and not (
      (old.status = 'at_processor' and new.status = 'processing')
      or (old.status = 'processing' and new.status = 'ready_for_pickup')
    ) then raise exception 'Invalid processor workflow transition'; end if;
    return new;
  end if;

  raise exception 'Role cannot update orders';
end;
$$;

drop trigger if exists protect_order_role_fields on public.orders;
create trigger protect_order_role_fields before update on public.orders
for each row execute procedure public.protect_order_role_fields();

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
  if actor.role in ('super_admin','dispatcher') then return new; end if;
  if actor.role <> 'customer' then raise exception 'Role cannot create orders'; end if;
  if new.customer_user_id is distinct from actor.id
     or new.status <> 'created'
     or new.validation_state <> 'manual_review'
     or new.processor_id is not null
     or new.assigned_driver_id is not null
     or new.actual_bags is not null
     or new.processor_bags is not null
     or new.completed_bags is not null
     or new.delivered_bags is not null
     or new.has_exception
     or new.archived_at is not null then
    raise exception 'Customer orders must begin in intake review';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_order_insert on public.orders;
create trigger protect_order_insert before insert on public.orders
for each row execute procedure public.protect_order_insert();

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
  if new.expected_bags <> order_record.expected_bags then raise exception 'Expected handoff count does not match the order'; end if;
  if not exists (
    select 1 from public.route_stops route_stop join public.route_plans route_plan on route_plan.id = route_stop.route_id
    where route_stop.order_id = new.order_id and route_stop.driver_id = actor.id and route_stop.route_type = required_route_type
      and route_stop.status in ('planned','arrived') and route_plan.status in ('approved','in_progress')
  ) then raise exception 'No active assigned route stop exists for this handoff'; end if;
  if not exists (select 1 from public.order_photos where order_id = new.order_id and kind = required_photo_kind) then raise exception 'Attach the required handoff photo first'; end if;
  return new;
end;
$$;

drop trigger if exists protect_handoff_write on public.order_handoffs;
create trigger protect_handoff_write before insert or update on public.order_handoffs
for each row execute procedure public.protect_handoff_write();
