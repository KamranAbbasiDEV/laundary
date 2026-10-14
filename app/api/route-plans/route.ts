import { NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateRoute, geocodeAddress } from '@/lib/mapbox';
import { hasRole, requireActiveUser } from '@/lib/api-auth';

const planSchema = z.object({ routeDate: z.string().date(), routeType: z.enum(['pickup','processor_pickup','delivery']), orderIds: z.array(z.string().uuid()).min(1), driverId: z.string().uuid().optional() });

export async function POST(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin','dispatcher'])) return NextResponse.json({ error: 'Dispatcher access required.' }, { status: 403 });
  const parsed = planSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Route date, type, orders, and a valid driver are required.' }, { status: 400 });
  try {
    const { data: orders, error: orderError } = await auth.client.from('orders').select('id,pickup_address,customer_delivery_address').in('id', parsed.data.orderIds);
    if (orderError || !orders?.length || orders.length !== parsed.data.orderIds.length) return NextResponse.json({ error: 'One or more route orders could not be found.' }, { status: 404 });
    const addresses = orders.map(order => parsed.data.routeType === 'delivery' ? order.customer_delivery_address ?? order.pickup_address : order.pickup_address);
    const geocoded = await Promise.all(addresses.map(geocodeAddress));
    const coordinates = geocoded.flatMap(item => item.coordinates ? [item.coordinates] : []) as [number, number][];
    const route = await calculateRoute(coordinates);
    const { data: plan, error: planError } = await auth.client.from('route_plans').insert({ route_date: parsed.data.routeDate, route_type: parsed.data.routeType, driver_id: parsed.data.driverId ?? null, status: 'draft', mapbox_route: route, created_by: auth.user.id }).select('*').single();
    if (planError) return NextResponse.json({ error: planError.message }, { status: 500 });
    const stops = parsed.data.orderIds.map((orderId, index) => ({ route_id: plan.id, route_date: parsed.data.routeDate, route_type: parsed.data.routeType, order_id: orderId, sequence: index + 1, driver_id: parsed.data.driverId ?? null }));
    const { error: stopError } = await auth.client.from('route_stops').insert(stops);
    if (stopError) return NextResponse.json({ error: stopError.message }, { status: 500 });
    return NextResponse.json({ plan, geocoded, route }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Route planning failed' }, { status: 502 }); }
}
