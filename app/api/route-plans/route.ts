import { NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateRoute, geocodeAddress } from '@/lib/mapbox';
import { hasRole, requireActiveUser } from '@/lib/api-auth';
import { logOperationalNotification } from '@/lib/notifications';

const planSchema = z.object({ routeDate: z.string().date(), routeType: z.enum(['pickup','processor_pickup','delivery']), orderIds: z.array(z.string().uuid()).min(1), driverId: z.string().uuid() });
const approveSchema = z.object({ planId: z.string().uuid() });

export async function POST(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin','dispatcher'])) return NextResponse.json({ error: 'Dispatcher access required.' }, { status: 403 });
  const parsed = planSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Route date, type, orders, and a valid driver are required.' }, { status: 400 });
  try {
    const { data: driver, error: driverError } = await auth.client.from('profiles').select('id').eq('id', parsed.data.driverId).eq('role', 'driver').eq('status', 'active').maybeSingle();
    if (driverError || !driver) return NextResponse.json({ error: 'Select an active Driver for this route.' }, { status: 400 });
    const { data: orders, error: orderError } = await auth.client.from('orders').select('id,order_number,pickup_address,customer_delivery_address,processor_id,status,phone').in('id', parsed.data.orderIds);
    if (orderError || !orders?.length || orders.length !== parsed.data.orderIds.length) return NextResponse.json({ error: 'One or more route orders could not be found.' }, { status: 404 });
    const expectedStatus = parsed.data.routeType === 'pickup' ? 'capacity_confirmed' : parsed.data.routeType === 'processor_pickup' ? 'ready_for_pickup' : 'picked_up_from_processor';
    if (orders.some(order => order.status !== expectedStatus)) return NextResponse.json({ error: 'One or more orders are not eligible for this route type.' }, { status: 409 });
    const processorIds = [...new Set(orders.map(order => order.processor_id).filter((id): id is string => typeof id === 'string'))];
    const { data: processors, error: processorError } = processorIds.length ? await auth.client.from('processors').select('id,address').in('id', processorIds) : { data: [], error: null };
    if (processorError) return NextResponse.json({ error: processorError.message }, { status: 500 });
    const processorAddresses = new Map((processors ?? []).map(processor => [processor.id, processor.address]));
    const addresses = orders.map(order => routeAddress(order, parsed.data.routeType, processorAddresses));
    if (addresses.some(address => !address)) return NextResponse.json({ error: 'Every selected order needs a valid destination address for this route type.' }, { status: 400 });
    const geocoded = await Promise.all((addresses as string[]).map(geocodeAddress));
    const coordinates = geocoded.flatMap(item => item.coordinates ? [item.coordinates] : []) as [number, number][];
    const route = await calculateRoute(coordinates);
    const { data: plan, error: planError } = await auth.client.from('route_plans').insert({ route_date: parsed.data.routeDate, route_type: parsed.data.routeType, driver_id: parsed.data.driverId, status: 'draft', mapbox_route: route, created_by: auth.user.id }).select('*').single();
    if (planError) return NextResponse.json({ error: planError.message }, { status: 500 });
    const stops = parsed.data.orderIds.map((orderId, index) => ({ route_id: plan.id, route_date: parsed.data.routeDate, route_type: parsed.data.routeType, order_id: orderId, sequence: index + 1 }));
    const { error: stopError } = await auth.client.from('route_stops').insert(stops);
    if (stopError) return NextResponse.json({ error: stopError.message }, { status: 500 });
    return NextResponse.json({ plan, geocoded, route }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Route planning failed' }, { status: 502 }); }
}

export async function PATCH(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin','dispatcher'])) return NextResponse.json({ error: 'Dispatcher access required.' }, { status: 403 });
  const parsed = approveSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'A valid route plan is required.' }, { status: 400 });
  const { data: plan, error: readError } = await auth.client.from('route_plans').select('id,status,route_type,driver_id').eq('id', parsed.data.planId).maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!plan) return NextResponse.json({ error: 'Route plan not found.' }, { status: 404 });
  if (plan.status !== 'draft') return NextResponse.json({ error: 'Only draft routes can be approved.' }, { status: 409 });
  const { data, error } = await auth.client.from('route_plans').update({ status: 'approved', approved_by: auth.user.id, approved_at: new Date().toISOString() }).eq('id', plan.id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: stops, error: stopsError } = await auth.client.from('route_stops').select('order_id,orders(order_number,phone)').eq('route_id', plan.id);
  if (stopsError) return NextResponse.json({ error: stopsError.message }, { status: 500 });
  const orderIds = (stops ?? []).map(stop => stop.order_id);
  if (orderIds.length && plan.driver_id) {
    const { error: stopUpdateError } = await auth.client.from('route_stops').update({ driver_id: plan.driver_id }).eq('route_id', plan.id);
    if (stopUpdateError) return NextResponse.json({ error: stopUpdateError.message }, { status: 500 });
    const { error: orderUpdateError } = await auth.client.from('orders').update({ assigned_driver_id: plan.driver_id, updated_at: new Date().toISOString() }).in('id', orderIds);
    if (orderUpdateError) return NextResponse.json({ error: orderUpdateError.message }, { status: 500 });
  }
  await Promise.all((stops ?? []).map(stop => { const order = Array.isArray(stop.orders) ? stop.orders[0] : stop.orders; return logOperationalNotification({ orderId: stop.order_id, event: 'route_approved', message: `${order?.order_number ?? 'Order'} has an approved ${plan.route_type.replace('_', ' ')} route.`, phone: order?.phone ?? undefined }); }));
  return NextResponse.json({ plan: data });
}

function routeAddress(order: { pickup_address: string; customer_delivery_address: string | null; processor_id: string | null }, routeType: 'pickup' | 'processor_pickup' | 'delivery', processorAddresses: Map<string, string | null>) {
  if (routeType === 'processor_pickup') return order.processor_id ? processorAddresses.get(order.processor_id) ?? null : null;
  return routeType === 'delivery' ? order.customer_delivery_address ?? order.pickup_address : order.pickup_address;
}
