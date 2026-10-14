import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendOrderNotification } from '@/lib/notifications';

const schema = z.object({ to: z.string().min(7), message: z.string().min(1).max(1500) });

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: 'Valid phone number and message are required' }, { status: 400 });
  return NextResponse.json(await sendOrderNotification({ ...body.data, channel: 'sms' }));
}
