import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendOrderNotification } from '@/lib/notifications';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getUserSafely } from '@/lib/supabase-auth';

const schema = z.object({ to: z.string().min(7), message: z.string().min(1).max(1500) });

export async function POST(request: Request) {
  const authClient = await createSupabaseServerClient();
  if (!authClient) return NextResponse.json({ error: 'The workspace is not configured.' }, { status: 503 });
  const { data: { user } } = await getUserSafely(authClient);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { data: profile } = await authClient.from('profiles').select('role,status').eq('id', user.id).single();
  if (!profile || profile.status !== 'active' || !['super_admin', 'dispatcher'].includes(profile.role)) return NextResponse.json({ error: 'Dispatcher access required' }, { status: 403 });
  const body = schema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: 'Valid phone number and message are required' }, { status: 400 });
  const result = await sendOrderNotification({ ...body.data, channel: 'sms' });
  return NextResponse.json(result, { status: result.delivered ? 200 : 503 });
}
