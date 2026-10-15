import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasRole, requireActiveUser } from '@/lib/api-auth';

const checkInSchema = z.object({ orderId: z.string().uuid() });

export async function POST(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['driver'])) return NextResponse.json({ error: 'Driver access required.' }, { status: 403 });
  const parsed = checkInSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'A valid assigned order is required.' }, { status: 400 });
  const { data: stop, error: stopError } = await auth.client.from('route_stops').select('id,checked_in_at').eq('order_id', parsed.data.orderId).eq('driver_id', auth.user.id).order('route_date', { ascending: false }).limit(1).maybeSingle();
  if (stopError) return NextResponse.json({ error: stopError.message }, { status: 500 });
  if (!stop) return NextResponse.json({ error: 'This order is not assigned to your route.' }, { status: 403 });
  if (stop.checked_in_at) return NextResponse.json({ checkedInAt: stop.checked_in_at, alreadyCheckedIn: true });
  const checkedInAt = new Date().toISOString();
  const { error: updateError } = await auth.client.from('route_stops').update({ checked_in_at: checkedInAt }).eq('id', stop.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ checkedInAt });
}
