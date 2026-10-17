import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasRole, requireActiveUser } from '@/lib/api-auth';

const locationSchema = z.object({ orderId: z.string().uuid(), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracyMeters: z.number().nonnegative().max(100000).optional() });

export async function POST(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['driver'])) return NextResponse.json({ error: 'Driver access required.' }, { status: 403 });
  const parsed = locationSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'A valid assigned stop location is required.' }, { status: 400 });
  const body = parsed.data;
  const { data: stop, error: stopError } = await auth.client.from('route_stops').select('id,route_id').eq('order_id', body.orderId).eq('driver_id', auth.user.id).order('route_date', { ascending: false }).limit(1).maybeSingle();
  if (stopError) return NextResponse.json({ error: stopError.message }, { status: 500 });
  if (!stop?.route_id) return NextResponse.json({ error: 'This order is not assigned to an active route.' }, { status: 403 });
  const { error } = await auth.client.from('driver_location_events').insert({ route_id: stop.route_id, driver_id: auth.user.id, latitude: body.latitude, longitude: body.longitude, accuracy_meters: body.accuracyMeters ?? null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ recorded: true });
}
