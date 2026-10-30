import { NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateRoute, geocodeAddress } from '@/lib/mapbox';
import { hasRole, requireActiveUser } from '@/lib/api-auth';
import { logOperationalNotification } from '@/lib/notifications';
import { getWorkspaceDate } from '@/lib/deadlines';

const planSchema = z.object({ routeDate: z.string().date(), routeType: z.enum(['pickup','processor_dropoff','processor_pickup','delivery']), orderIds: z.array(z.string().uuid()).min(1), driverId: z.string().uuid() });
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
  const routeStatuses = auth.profile.role === 'driver' ? ['approved', 'in_progress', 'failed'] : ['draft', 'approved', 'in_progress', 'failed'];
  let planQuery = auth.client.from('route_plans').select('id,route_date,route_type,status,driver_id,mapbox_route,created_at,route_stops(id,order_id,sequence,status,latitude,longitude,checked_in_at,completed_at,failure_reason,orders(order_number,customer_name,pickup_address,customer_delivery_address,processor_id,due_at,has_exception))').in('status', routeStatuses).or(`route_date.gte.${today},status.in.(approved,in_progress,failed)`).order('route_date', { ascending: true }).limit(50);
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
    const stops = (plan.route_stops ?? []) as Array<{ status?: string; orders?: { due_at?: string | null; has_exception?: boolean } | Array<{ due_at?: string | null; has_exception?: boolean }> }>;
    const pending = stops.filter((stop) => stop.status !== 'completed');
    const failed = stops.filter((stop) => stop.status === 'failed').length;
    const urgent = pending.filter((stop) => { const order = Array.isArray(stop.orders) ? stop.orders[0] : stop.orders; return Boolean(order?.has_exception) || Boolean(order?.due_at && new Date(order.due_at).getTime() - Date.now() <= 24 * 60 * 60 * 1000); }).length;
    const urgency = failed || pending.some((stop) => { const order = Array.isArray(stop.orders) ? stop.orders[0] : stop.orders; return Boolean(order?.due_at && new Date(order.due_at).getTime() < Date.now()); }) ? 'overdue' : urgent ? 'due_soon' : 'on_track';
    const routeStops = [...(plan.route_stops ?? [])].sort((a, b) => a.sequence - b.sequence).map(stop => {
      const order = Array.isArray(stop.orders) ? stop.orders[0] : stop.orders;
      const processor = order?.processor_id ? processorById.get(order.processor_id) : undefined;
      const address = ['processor_dropoff', 'processor_pickup'].includes(plan.route_type) ? processor?.address : plan.route_type === 'delivery' ? order?.customer_delivery_address ?? order?.pickup_address : order?.pickup_address;
      return { ...stop, address: address ?? null, destination_name: ['processor_dropoff', 'processor_pickup'].includes(plan.route_type) ? processor?.name ?? 'Processor facility' : plan.route_type === 'delivery' ? 'Customer delivery' : 'Customer pickup' };
    });
    return { ...plan, route_stops: routeStops, progress: stops.length ? Math.round(((stops.length - pending.length) / stops.length) * 100) : 0, failed_stops: failed, urgent_stops: urgent, urgency, driver_location: latestLocations.get(plan.id) ?? null };
  });
  return NextResponse.json({ plans });
}

export async function POST(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin','dispatcher'])) return NextResponse.json({ error: 'Dispatcher access required.' }, { status: 403 });
  const parsed = planSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Route date, type, orders, and a valid driver are required.' }, { status: 400 });
  try {
    const { data: driver, error: driverError } = await auth.client.from('profiles').select('id').eq('id', parsed.data.driverId).eq('role', 'driver').eq('status', 'active').maybeSingle();
    if (driverError || !driver) return NextResponse.json({ error: 'Select an active Driver for this route.' }, { status: 400 });
    const { data: workspace } = await auth.client.from('workspace_settings').select('timezone').eq('id', 'default').maybeSingle();
    const workspaceTimezone = workspace?.timezone || 'UTC';
    const { data: orders, error: orderError } = await auth.client.from('orders').select('id,order_number,pickup_address,customer_delivery_address,processor_id,status,phone,pickup_window_start_at').in('id', parsed.data.orderIds);
    if (orderError || !orders?.length || orders.length !== parsed.data.orderIds.length) return NextResponse.json({ error: 'One or more route orders could not be found.' }, { status: 404 });
    const expectedStatus = parsed.data.routeType === 'pickup' ? 'capacity_confirmed' : parsed.data.routeType === 'processor_dropoff' ? 'picked_up' : parsed.data.routeType === 'processor_pickup' ? 'ready_for_pickup' : 'out_for_delivery';
    if (orders.some(order => order.status !== expectedStatus)) return NextResponse.json({ error: 'One or more orders are not eligible for this route type.' }, { status: 409 });
    if (parsed.data.routeType === 'pickup' && orders.some(order => order.pickup_window_start_at && calendarDateInTimezone(order.pickup_window_start_at, workspaceTimezone) !== parsed.data.routeDate)) return NextResponse.json({ error: 'Customer pickup routes must use each order\'s pickup window date.' }, { status: 409 });
    const { data: existingStops, error: existingStopsError } = await auth.client.from('route_stops').select('order_id,route_plans!inner(id,status,route_type)').in('order_id', parsed.data.orderIds).eq('route_plans.route_type', parsed.data.routeType).in('route_plans.status', ['draft', 'approved', 'in_progress', 'failed']);
    if (existingStopsError) return NextResponse.json({ error: existingStopsError.message }, { status: 500 });
    if ((existingStops ?? []).length) return NextResponse.json({ error: 'One or more selected orders already belong to a draft, approved, active, or failed route of this type. Open that route instead of creating a duplicate.' }, { status: 409 });
    const processorIds = [...new Set(orders.map(order => order.processor_id).filter((id): id is string => typeof id === 'string'))];
    const { data: processors, error: processorError } = processorIds.length ? await auth.client.from('processors').select('id,address').in('id', processorIds) : { data: [], error: null };
    if (processorError) return NextResponse.json({ error: processorError.message }, { status: 500 });
    const processorAddresses = new Map((processors ?? []).map(processor => [processor.id, processor.address]));
    const addresses = orders.map(order => routeAddress(order, parsed.data.routeType, processorAddresses));
    if (addresses.some(address => !address)) return NextResponse.json({ error: 'Every selected order needs a valid destination address for this route type.' }, { status: 400 });
    const geocoded = await Promise.all((addresses as string[]).map(geocodeAddress));
    const coordinates = geocoded.map(item => item.coordinates);
    const route = await calculateRoute(coordinates);
    const { data: planId, error: planError } = await auth.client.rpc('create_route_plan', {
      p_route_date: parsed.data.routeDate,
      p_route_type: parsed.data.routeType,
      p_order_ids: parsed.data.orderIds,
      p_driver_id: parsed.data.driverId,
      p_mapbox_route: route,
      p_longitudes: geocoded.map(item => item.coordinates[0]),
      p_latitudes: geocoded.map(item => item.coordinates[1])
    });
    if (planError || !planId) return NextResponse.json({ error: planError?.message ?? 'Route plan could not be created.' }, { status: 409 });
    const [{ data: plan, error: readPlanError }, { data: createdStops, error: readStopsError }] = await Promise.all([
      auth.client.from('route_plans').select('*').eq('id', planId).single(),
      auth.client.from('route_stops').select('id,order_id,sequence').eq('route_id', planId).order('sequence')
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
    const { data: existing, error: stopsError } = await auth.client.from('route_stops').select('id,latitude,longitude').eq('route_id', plan.id);
    if (stopsError) return NextResponse.json({ error: stopsError.message }, { status: 500 });
    if ((existing ?? []).length !== reorder.data.stopIds.length || !reorder.data.stopIds.every((id) => (existing ?? []).some((stop) => stop.id === id))) return NextResponse.json({ error: 'Route stops no longer match this draft. Refresh and try again.' }, { status: 409 });
    const stopById = new Map((existing ?? []).map(stop => [stop.id, stop]));
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
    const { data: stops, error: stopsError } = await auth.client.from('route_stops').select('id,order_id,sequence,status').eq('route_id', recover.data.planId).order('sequence');
    if (stopsError) return NextResponse.json({ error: stopsError.message }, { status: 500 });
    return NextResponse.json({ plan: data, stops: stops ?? [] });
  }
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: 'A valid route plan is required.' }, { status: 400 });
  const { error: approvalError } = await auth.client.rpc('approve_route_plan', { p_plan_id: parsed.data.planId });
  if (approvalError) return NextResponse.json({ error: approvalError.message }, { status: 409 });
  const { data, error } = await auth.client.from('route_plans').select('*').eq('id', parsed.data.planId).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: pendingStops, error: stopsError } = await auth.client.from('route_stops').select('order_id,orders(order_number,phone,due_at)').eq('route_id', parsed.data.planId).neq('status', 'completed');
  if (stopsError) return NextResponse.json({ error: stopsError.message }, { status: 500 });
  await Promise.all((pendingStops ?? []).map(stop => { const order = Array.isArray(stop.orders) ? stop.orders[0] : stop.orders; const deadline = order?.due_at ? ` Deadline: ${new Date(order.due_at).toLocaleString()}.` : ''; return logOperationalNotification({ orderId: stop.order_id, event: 'route_approved', message: `${order?.order_number ?? 'Order'} has an approved ${data.route_type.replace('_', ' ')} route.${deadline}`, phone: order?.phone ?? undefined }, auth.client); }));
  return NextResponse.json({ plan: data });
}

function routeAddress(order: { pickup_address: string; customer_delivery_address: string | null; processor_id: string | null }, routeType: 'pickup' | 'processor_dropoff' | 'processor_pickup' | 'delivery', processorAddresses: Map<string, string | null>) {
  if (routeType === 'processor_pickup' || routeType === 'processor_dropoff') return order.processor_id ? processorAddresses.get(order.processor_id) ?? null : null;
  return routeType === 'delivery' ? order.customer_delivery_address ?? order.pickup_address : order.pickup_address;
}
