import { NextResponse } from 'next/server';
import { hasRole, requireActiveUser } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = supabaseAdmin ?? auth.client;
  const { data: preferences } = await auth.client.from('notification_preferences').select('in_app_enabled').eq('user_id', auth.user.id).maybeSingle();
  if (preferences?.in_app_enabled === false) return NextResponse.json({ notifications: [] });
  let orderIds: string[] | null = null;
  if (auth.profile.role === 'driver') { const { data } = await db.from('orders').select('id').eq('assigned_driver_id', auth.user.id); orderIds = (data ?? []).map(order => order.id); }
  if (auth.profile.role === 'processor' && auth.profile.processor_id) {
    const [{ data: assigned }, { data: offers }] = await Promise.all([
      db.from('orders').select('id').eq('processor_id', auth.profile.processor_id),
      db.from('processor_offers').select('order_id').eq('processor_id', auth.profile.processor_id)
    ]);
    orderIds = [...new Set([...(assigned ?? []).map(order => order.id), ...(offers ?? []).map(offer => offer.order_id)])];
  }
  if (auth.profile.role === 'customer') { const { data } = await db.from('orders').select('id').eq('customer_user_id', auth.user.id); orderIds = (data ?? []).map(order => order.id); }
  if (orderIds && !orderIds.length) return NextResponse.json({ notifications: [] });
  let query = db.from('notification_log').select('id,order_id,channel,event,message,status,created_at,sent_at').eq('channel', 'in_app').order('created_at', { ascending: false }).limit(30);
  if (orderIds) query = query.in('order_id', orderIds);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notifications: data ?? [] });
}
