import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendOrderNotification } from '@/lib/notifications';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const schema = z.object({ to: z.string().min(7), message: z.string().min(1).max(1500) });

export async function POST(request: Request) {
  const authClient = await createSupabaseServerClient();
  if (authClient) { const { data: { user } } = await authClient.auth.getUser(); if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 }); }
  const body = schema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: 'Valid phone number and message are required' }, { status: 400 });
  return NextResponse.json(await sendOrderNotification({ ...body.data, channel: 'sms' }));
}
