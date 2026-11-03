import { NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateRoute, geocodeAddress } from '@/lib/mapbox';
import { hasRole, requireActiveUser } from '@/lib/api-auth';
import { logOperationalNotification, logSmsNotification } from '@/lib/notifications';
import { getWorkspaceDate } from '@/lib/deadlines';

const routeTypeSchema = z.enum(['pickup','processor_dropoff','processor_pickup','delivery']);
const routeTypeLabels: Record<z.infer<typeof routeTypeSchema>, string> = {
  pickup: 'customer pickup',
  processor_dropoff: 'processor drop-off',
  processor_pickup: 'processor pickup',
  delivery: 'customer delivery'
};
const planSchema = z.object({ routeDate: z.string().date(), stops: z.array(z.object({ orderId: z.string().uuid(), routeType: routeTypeSchema })).min(1).max(25, 'A route can contain at most 25 stops.'), driverId: z.string().uuid() }).superRefine((value, context) => {
  const keys = value.stops.map(stop => `${stop.orderId}:${stop.routeType}`);
  if (new Set(keys).size !== keys.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['stops'], message: 'A route cannot contain the same order action twice.' });
  value.stops.forEach((stop, index) => {
    const prerequisite = stop.routeType === 'processor_dropoff' ? 'pickup' : stop.routeType === 'delivery' ? 'processor_pickup' : null;
    if (!prerequisite) return;
    const prerequisiteIndex = value.stops.findIndex(candidate => candidate.orderId === stop.orderId && candidate.routeType === prerequisite);
    if (prerequisiteIndex > index) context.addIssue({ code: z.ZodIssueCode.custom, path: ['stops', index], message: 'A dependent route stop cannot come before its pickup.' });
  });
});
const approveSchema = z.object({ planId: z.string().uuid() });
const reorderSchema = z.object({ action: z.literal('reorder'), planId: z.string().uuid(), stopIds: z.array(z.string().uuid()).min(1) });
const cancelSchema = z.object({ action: z.literal('cancel'), planId: z.string().uuid(), reason: z.string().min(3).max(1000) });
const recoverSchema = z.object({ action: z.literal('recover'), planId: z.string().uuid() });
function calendarDateInTimezone(value: string, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
    const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch { return calendarDateInTimezone(value, 'UTC'); }
}

export async function GET() {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher', 'driver'])) return NextResponse.json({ error: 'Operations access required.' }, { status: 403 });
  const { data: workspace } = await auth.client.from('workspace_settings').select('timezone').eq('id', 'default').maybeSingle();
  const today = getWorkspaceDate(new Date(), workspace?.timezone || 'UTC');
  const routeStatuses = auth.profile.role === 'driver' ? ['approved', 'in_progress'] : ['draft', 'approved', 'in_progress', 'failed'];
  // Keep every open draft visible, even when its planned date has passed. The
  // orders feed treats those stops as drafted, so hiding an old draft here
  // would leave the order ineligible with no route the dispatcher could open
  // or cancel.
  let planQuery = auth.client.from('route_plans').select('id,route_date,route_type,status,driver_id,mapbox_route,created_at,route_stops(id,order_id,route_type,sequence,status,latitude,longitude,checked_in_at,completed_at,failure_reason,orders(order_number,customer_name,pickup_address,customer_delivery_address,processor_id,assigned_driver_id,status,due_at,has_exception))').in('status', routeStatuses).or(`route_date.gte.${today},status.in.(draft,approved,in_progress,failed)`).order('route_date', { ascending: false }).order('created_at', { ascending: false }).limit(50);
  if (auth.profile.role === 'driver') planQuery = planQuery.eq('driver_id', auth.user.id);
  const { data, error } = await planQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const routeIds = (data ?? []).map((plan) => plan.id);
  const { data: locations, error: locationError } = routeIds.length ? await auth.client.from('driver_location_events').select('route_id,driver_id,latitude,longitude,accuracy_meters,recorded_at').in('route_id', routeIds).order('recorded_at', { ascending: false }).limit(100) : { data: [], error: null };
  if (locationError) return NextResponse.json({ error: locationError.message }, { status: 500 });
  const latestLocations = new Map<string, { route_id: string; driver_id: string; latitude: number; longitude: number; accuracy_meters: number | null; recorded_at: string }>();
  (locations ?? []).forEach((location) => { if (!latestLocations.has(location.route_id)) latestLocations.set(location.route_id, location); });
  const processorIds = [...new Set((data ?? []).flatMap(plan => (plan.route_stops ?? []).map(stop => { const order = Array.isArray(stop.orders) ? stop.orders[0] : stop.orders; return order?.processor_id; }).filter((id): id is string => typeof id === 'string')) )];
  const { data: processors } = processorIds.length ? await auth.client.from('processors').select('id,name,address').in('id', processorIds) : { data: [] };
  const processorById = new Map((processors ?? []).map(processor => [processor.id, processor]));
  const plans = (data ?? []).map((plan) => {
    const stops = (plan.route_stops ?? []) as Array<{ status?: string; orders?: { due_at?: string | null; has_exception?: boolean; status?: string | null } | Array<{ due_at?: string | null; has_exception?: boolean; status?: string | null }> }>;
    const pending = stops.filter((stop) => stop.status !== 'completed');
    const failed = stops.filter((stop) => stop.status === 'failed').length;
    const activePending = pending.filter((stop) => {
      const order = Array.isArray(stop.orders) ? stop.orders[0] : stop.orders;
      return order && !['delivered', 'processor_reviewed'].includes(order.status ?? '');
    });
    const now = Date.now();
    const overdue = activePending.filter((stop) => {
      const order = Array.isArray(stop.orders) ? stop.orders[0] : stop.orders;
      return Boolean(order?.due_at && new Date(order.due_at).getTime() < now);
    }).length;
    const urgent = activePending.filter((stop) => {
      const order = Array.isArray(stop.orders) ? stop.orders[0] : stop.orders;
      const deadline = order?.due_at ? new Date(order.due_at).getTime() : null;
      return Boolean(order?.has_exception) || Boolean(deadline && deadline >= now && deadline - now <= 24 * 60 * 60 * 1000);
    }).length;
    const urgency = overdue ? 'overdue' : failed || activePending.some((stop) => { const order = Array.isArray(stop.orders) ? stop.orders[0] : stop.orders; return Boolean(order?.has_exception); }) ? 'at_risk' : urgent ? 'due_soon' : 'on_track';
    const routeStops = [...(plan.route_stops ?? [])].sort((a, b) => a.sequence - b.sequence).map(stop => {
      const order = Array.isArray(stop.orders) ? stop.orders[0] : stop.orders;
      const processor = order?.processor_id ? processorById.get(order.processor_id) : undefined;
      const stopType = stop.route_type;
      const address = ['processor_dropoff', 'processor_pickup'].includes(stopType) ? processor?.address : stopType === 'delivery' ? order?.customer_delivery_address ?? order?.pickup_address : order?.pickup_address;
      return { ...stop, address: address ?? null, destination_name: ['processor_dropoff', 'processor_pickup'].includes(stopType) ? processor?.name ?? 'Processor facility' : stopType === 'delivery' ? 'Customer delivery' : 'Customer pickup' };
    });
    return { ...plan, route_stops: routeStops, progress: stops.length ? Math.round(((stops.length - pending.length) / stops.length) * 100) : 0, failed_stops: failed, urgent_stops: urgent, urgency, driver_location: latestLocations.get(plan.id) ?? null };
  });
  const driverStatusByRouteType: Record<string, string> = { pickup: 'pickup_scheduled', processor_dropoff: 'picked_up', processor_pickup: 'ready_for_pickup', delivery: 'out_for_delivery' };
  const visiblePlans = auth.profile.role === 'driver' ? plans.filter(plan => plan.route_stops.some(stop => {
    const order = Array.isArray(stop.orders) ? stop.orders[0] : stop.orders;
    const betweenReturnStops = stop.route_type === 'delivery' && ['picked_up_from_processor', 'qc_reconciliation'].includes(order?.status ?? '');
    return ['planned', 'arrived'].includes(stop.status) && order?.assigned_driver_id === auth.user.id && (order?.status === driverStatusByRouteType[stop.route_type] || betweenReturnStops);
  })) : plans;
  return NextResponse.json({ plans: visiblePlans });
}

export async function POST(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin','dispatcher'])) return NextResponse.json({ error: 'Dispatcher access required.' }, { status: 403 });
  const parsed = planSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Route date, eligible stops, and a valid driver are required.' }, { status: 400 });
  try {
    const { data: driver, error: driverError } = await auth.client.from('profiles').select('id').eq('id', parsed.data.driverId).eq('role', 'driver').eq('status', 'active').maybeSingle();
    if (driverError || !driver) return NextResponse.json({ error: 'Select an active Driver for this route.' }, { status: 400 });
    const { data: workspace } = await auth.client.from('workspace_settings').select('timezone').eq('id', 'default').maybeSingle();
    const workspaceTimezone = workspace?.timezone || 'UTC';
    const orderIds = [...new Set(parsed.data.stops.map(stop => stop.orderId))];
    const { data: orders, error: orderError } = await auth.client.from('orders').select('id,order_number,pickup_address,customer_delivery_address,processor_id,status,phone,pickup_window_start_at,delivery_window_start_at').in('id', orderIds);
    if (orderError || !orders?.length || orders.length !== orderIds.length) return NextResponse.json({ error: 'One or more route orders could not be found.' }, { status: 404 });
    const orderById = new Map(orders.map(order => [order.id, order]));
    const stopTypesByOrder = new Map<string, Set<z.infer<typeof routeTypeSchema>>>();
    parsed.data.stops.forEach(stop => { const types = stopTypesByOrder.get(stop.orderId) ?? new Set(); types.add(stop.routeType); stopTypesByOrder.set(stop.orderId, types); });
    const isEligible = (stop: z.infer<typeof planSchema>['stops'][number]) => {
      const status = orderById.get(stop.orderId)?.status;
      const pairedTypes = stopTypesByOrder.get(stop.orderId);
      if (stop.routeType === 'pickup') return status === 'capacity_confirmed';
      if (stop.routeType === 'processor_dropoff') return status === 'picked_up' || (status === 'capacity_confirmed' && pairedTypes?.has('pickup'));
      if (stop.routeType === 'processor_pickup') return status === 'ready_for_pickup';
      return status === 'out_for_delivery' || (status === 'ready_for_pickup' && pairedTypes?.has('processor_pickup'));
    };
    if (parsed.data.stops.some(stop => !isEligible(stop))) return NextResponse.json({ error: 'One or more orders are no longer eligible for their selected stop sequence.' }, { status: 409 });
    if (parsed.data.stops.some(stop => stop.routeType === 'pickup' && orderById.get(stop.orderId)?.pickup_window_start_at && calendarDateInTimezone(orderById.get(stop.orderId)!.pickup_window_start_at, workspaceTimezone) !== parsed.data.routeDate)) return NextResponse.json({ error: 'Customer pickup stops must use each order\'s pickup window date.' }, { status: 409 });
    if (parsed.data.stops.some(stop => stop.routeType === 'delivery' && orderById.get(stop.orderId)?.delivery_window_start_at && calendarDateInTimezone(orderById.get(stop.orderId)!.delivery_window_start_at, workspaceTimezone) !== parsed.data.routeDate)) return NextResponse.json({ error: 'Customer delivery stops must use each order\'s delivery window date.' }, { status: 409 });
    const { data: existingStops, error: existingStopsError } = await auth.client.from('route_stops').select('order_id,route_type,route_plans!inner(id,status)').in('order_id', orderIds).in('route_plans.status', ['draft', 'approved', 'in_progress', 'failed']);
    if (existingStopsError) return NextResponse.json({ error: existingStopsError.message }, { status: 500 });
    if ((existingStops ?? []).some(existing => parsed.data.stops.some(stop => stop.orderId === existing.order_id && stop.routeType === existing.route_type))) return NextResponse.json({ error: 'One or more selected orders already belong to an open route for the same stop. Open that route instead of creating a duplicate.' }, { status: 409 });
    const processorIds = [...new Set(orders.map(order => order.processor_id).filter((id): id is string => typeof id === 'string'))];
    const { data: processors, error: processorError } = processorIds.length ? await auth.client.from('processors').select('id,address').in('id', processorIds) : { data: [], error: null };
    if (processorError) return NextResponse.json({ error: processorError.message }, { status: 500 });
    const processorAddresses = new Map((processors ?? []).map(processor => [processor.id, processor.address]));
    const orderedOrders = parsed.data.stops.map(stop => orderById.get(stop.orderId)!);
    const addresses = parsed.data.stops.map((stop, index) => routeAddress(orderedOrders[index], stop.routeType, processorAddresses));
    const missingAddressIndex = addresses.findIndex(address => !address?.trim());
    if (missingAddressIndex >= 0) {
      const stop = parsed.data.stops[missingAddressIndex];
      const order = orderedOrders[missingAddressIndex];
      const destination = ['processor_dropoff', 'processor_pickup'].includes(stop.routeType) ? 'assigned processor facility address' : stop.routeType === 'delivery' ? 'customer delivery address' : 'customer pickup address';
      return NextResponse.json({ error: `${order.order_number} is missing its ${destination}. Complete that record before generating the route.` }, { status: 400 });
    }
    const geocoded = await Promise.all((addresses as string[]).map(geocodeAddress));
    const coordinates = geocoded.map(item => item.coordinates);
    let route: Awaited<ReturnType<typeof calculateRoute>>;
    try {
      route = await calculateRoute(coordinates);
    } catch (error) {
      const resolvedStops = geocoded.slice(0, 3).map((item, index) => `${orderedOrders[index].order_number} ${routeTypeLabels[parsed.data.stops[index].routeType]}: ${item.address}`).join('; ');
      const additionalStops = geocoded.length > 3 ? `; plus ${geocoded.length - 3} more stop${geocoded.length === 4 ? '' : 's'}` : '';
      const providerReason = error instanceof Error ? error.message.replace(/^Mapbox could not build a drivable route \(422\)\.\s*/, '') : 'No road route was returned.';
      const guidance = /maximum distance/i.test(providerReason)
        ? 'The assigned processor is too far from the customer for a drivable route. Update the processor address or reassign the order, then try again.'
        : 'Verify that the customer and processor addresses are accurate and in the same service region.';
      return NextResponse.json({ error: `${guidance} Resolved stops — ${resolvedStops}${additionalStops}.` }, { status: 422 });
    }
    const { data: planId, error: planError } = await auth.client.rpc('create_mixed_route_plan', {
      p_route_date: parsed.data.routeDate,
      p_order_ids: parsed.data.stops.map(stop => stop.orderId),
      p_route_types: parsed.data.stops.map(stop => stop.routeType),
      p_driver_id: parsed.data.driverId,
      p_mapbox_route: route,
      p_longitudes: geocoded.map(item => item.coordinates[0]),
      p_latitudes: geocoded.map(item => item.coordinates[1])
    });
    if (planError || !planId) return NextResponse.json({ error: planError?.message ?? 'Route plan could not be created.' }, { status: 409 });
    const [{ data: plan, error: readPlanError }, { data: createdStops, error: readStopsError }] = await Promise.all([
      auth.client.from('route_plans').select('*').eq('id', planId).single(),
      auth.client.from('route_stops').select('id,order_id,route_type,sequence').eq('route_id', planId).order('sequence')
    ]);
    if (readPlanError || readStopsError) return NextResponse.json({ error: readPlanError?.message ?? readStopsError?.message }, { status: 500 });
    return NextResponse.json({ plan, stops: createdStops ?? [], geocoded, route }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Route planning failed' }, { status: 502 }); }
}

export async function PATCH(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin','dispatcher'])) return NextResponse.json({ error: 'Dispatcher access required.' }, { status: 403 });
  const input = await request.json();
  const reorder = reorderSchema.safeParse(input);
  const cancel = cancelSchema.safeParse(input);
  const recover = recoverSchema.safeParse(input);
  if (reorder.success) {
    const { data: plan, error: planError } = await auth.client.from('route_plans').select('id,status').eq('id', reorder.data.planId).maybeSingle();
    if (planError || !plan) return NextResponse.json({ error: 'Route plan not found.' }, { status: 404 });
    if (plan.status !== 'draft') return NextResponse.json({ error: 'Only draft routes can be reordered.' }, { status: 409 });
    const { data: existing, error: stopsError } = await auth.client.from('route_stops').select('id,order_id,route_type,latitude,longitude').eq('route_id', plan.id);
    if (stopsError) return NextResponse.json({ error: stopsError.message }, { status: 500 });
    if ((existing ?? []).length !== reorder.data.stopIds.length || !reorder.data.stopIds.every((id) => (existing ?? []).some((stop) => stop.id === id))) return NextResponse.json({ error: 'Route stops no longer match this draft. Refresh and try again.' }, { status: 409 });
    const stopById = new Map((existing ?? []).map(stop => [stop.id, stop]));
    const proposed = reorder.data.stopIds.map(id => stopById.get(id)!);
    const precedes = (orderId: string, prerequisite: string, dependentIndex: number) => { const prerequisiteIndex = proposed.findIndex(stop => stop.order_id === orderId && stop.route_type === prerequisite); return prerequisiteIndex === -1 || prerequisiteIndex < dependentIndex; };
    if (proposed.some((stop, index) => (stop.route_type === 'processor_dropoff' && !precedes(stop.order_id, 'pickup', index)) || (stop.route_type === 'delivery' && !precedes(stop.order_id, 'processor_pickup', index)))) {
      return NextResponse.json({ error: 'Customer pickup must stay before processor drop-off, and processor pickup must stay before customer delivery for the same order.' }, { status: 409 });
    }
    const stopCoordinates = reorder.data.stopIds.flatMap(stopId => {
      const stop = stopById.get(stopId);
      return typeof stop?.longitude === 'number' && typeof stop?.latitude === 'number' ? [[stop.longitude, stop.latitude] as [number, number]] : [];
    });
    if (stopCoordinates.length !== reorder.data.stopIds.length) return NextResponse.json({ error: 'One or more route stops are missing map coordinates. Cancel and regenerate this draft.' }, { status: 409 });
    try {
      const route = await calculateRoute(stopCoordinates);
      const { error: routeError } = await auth.client.rpc('reorder_route_plan', { p_plan_id: plan.id, p_stop_ids: reorder.data.stopIds, p_mapbox_route: route });
      if (routeError) return NextResponse.json({ error: routeError.message }, { status: 500 });
      return NextResponse.json({ reordered: true, route, stopCoordinates });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to recalculate the route.' }, { status: 502 });
    }
  }
  if (cancel.success) {
    const { data: plan, error: planError } = await auth.client.from('route_plans').select('id,status').eq('id', cancel.data.planId).maybeSingle();
    if (planError || !plan) return NextResponse.json({ error: 'Route plan not found.' }, { status: 404 });
    if (plan.status !== 'draft') return NextResponse.json({ error: 'Only draft routes can be cancelled.' }, { status: 409 });
    const { error } = await auth.client.from('route_plans').delete().eq('id', plan.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ cancelled: true, reason: cancel.data.reason });
  }
  if (recover.success) {
    const { error: recoveryError } = await auth.client.rpc('recover_route_plan', { p_plan_id: recover.data.planId });
    if (recoveryError) return NextResponse.json({ error: recoveryError.message }, { status: 409 });
    const { data, error } = await auth.client.from('route_plans').select('id,route_date,route_type,status,driver_id,mapbox_route').eq('id', recover.data.planId).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { data: stops, error: stopsError } = await auth.client.from('route_stops').select('id,order_id,route_type,sequence,status').eq('route_id', recover.data.planId).order('sequence');
    if (stopsError) return NextResponse.json({ error: stopsError.message }, { status: 500 });
    return NextResponse.json({ plan: data, stops: stops ?? [] });
  }
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: 'A valid route plan is required.' }, { status: 400 });
  const { error: approvalError } = await auth.client.rpc('approve_route_plan', { p_plan_id: parsed.data.planId });
  if (approvalError) return NextResponse.json({ error: approvalError.message }, { status: 409 });
  const { data, error } = await auth.client.from('route_plans').select('*').eq('id', parsed.data.planId).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: pendingStops, error: stopsError } = await auth.client.from('route_stops').select('order_id,route_type,orders(order_number,phone,due_at)').eq('route_id', parsed.data.planId).neq('status', 'completed');
  if (stopsError) return NextResponse.json({ error: stopsError.message }, { status: 500 });
  await Promise.all((pendingStops ?? []).map(stop => { const order = Array.isArray(stop.orders) ? stop.orders[0] : stop.orders; const deadline = order?.due_at ? ` Deadline: ${new Date(order.due_at).toLocaleString()}.` : ''; return logOperationalNotification({ orderId: stop.order_id, event: 'route_approved', message: `${order?.order_number ?? 'Order'} has an approved ${stop.route_type.replaceAll('_', ' ')} stop.${deadline}`, phone: order?.phone ?? undefined }, auth.client); }));
  const firstStop = pendingStops?.[0];
  if (firstStop && data.driver_id) {
    const { data: driver, error: driverError } = await auth.client.from('profiles').select('id,phone').eq('id', data.driver_id).eq('role', 'driver').eq('status', 'active').maybeSingle();
    if (driverError) console.error('Unable to load the route driver for SMS notification:', driverError.message);
    else await logSmsNotification({ orderId: firstStop.order_id, event: 'route_approved', message: `Your route for ${data.route_date} is approved with ${pendingStops?.length ?? 0} stop${pendingStops?.length === 1 ? '' : 's'}. Sign in to review the route.`, phone: driver?.phone, userId: driver?.id }, auth.client);
  }
  return NextResponse.json({ plan: data });
}

function routeAddress(order: { pickup_address: string; customer_delivery_address: string | null; processor_id: string | null }, routeType: 'pickup' | 'processor_dropoff' | 'processor_pickup' | 'delivery', processorAddresses: Map<string, string | null>) {
  if (routeType === 'processor_pickup' || routeType === 'processor_dropoff') return order.processor_id ? processorAddresses.get(order.processor_id) ?? null : null;
  return routeType === 'delivery' ? order.customer_delivery_address ?? order.pickup_address : order.pickup_address;
}
