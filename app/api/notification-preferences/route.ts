import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser } from '@/lib/api-auth';

const preferenceSchema = z.object({ inAppEnabled: z.boolean(), smsEnabled: z.boolean(), processorOfferSms: z.boolean(), routeUpdateSms: z.boolean() });

export async function GET() {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await auth.client.from('notification_preferences').select('*').eq('user_id', auth.user.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ preferences: data ?? { in_app_enabled: true, sms_enabled: true, processor_offer_sms: true, route_update_sms: true } });
}

export async function PUT(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = preferenceSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid notification preferences.' }, { status: 400 });
  const body = parsed.data;
  const { data, error } = await auth.client.from('notification_preferences').upsert({ user_id: auth.user.id, in_app_enabled: body.inAppEnabled, sms_enabled: body.smsEnabled, processor_offer_sms: body.processorOfferSms, route_update_sms: body.routeUpdateSms, updated_at: new Date().toISOString() }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ preferences: data });
}
