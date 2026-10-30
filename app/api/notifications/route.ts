import { NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/api-auth';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const updateSchema = z.object({ action: z.enum(['mark_read', 'mark_all_read', 'clear_all']), notificationId: z.string().uuid().optional() });

function roleCanSeeOperationalEvent(role: string, event: string) {
  if (role === 'super_admin' || role === 'dispatcher') return true;
  if (role === 'driver') return event.startsWith('route_') || event.startsWith('exception_') || event.startsWith('deadline_') || ['order_pickup_scheduled', 'order_picked_up', 'order_ready_for_pickup', 'order_picked_up_from_processor', 'order_out_for_delivery', 'order_delivered'].includes(event);
  if (role === 'processor') return ['processor_offer', 'processor_offer_accepted', 'processor_offer_rejected'].includes(event) || event.startsWith('route_') || event.startsWith('exception_') || event.startsWith('deadline_') || ['order_picked_up', 'order_at_processor', 'order_processing', 'order_ready_for_pickup', 'order_picked_up_from_processor'].includes(event);
  return false;
}

function targetFor(role: string, event: string) {
  if (role === 'customer') return 'Customer portal';
  if (role === 'driver') return 'Driver app';
  if (role === 'processor') return 'Processor portal';
  if (event.includes('route')) return 'Routes';
  if (event === 'processor_review_due') return 'Reports';
  if (event.includes('processor') || event.includes('exception') || event === 'order_created' || event === 'order_validated') return 'Dispatch';
  return 'Orders';
}

async function visibleNotificationIds(auth: Awaited<ReturnType<typeof requireActiveUser>>, db: SupabaseClient) {
  if ('error' in auth) return [] as string[];
  let orderIds: string[] | null = null;
  if (auth.profile.role === 'driver') { const { data } = await db.from('orders').select('id').eq('assigned_driver_id', auth.user.id); orderIds = (data ?? []).map(order => order.id); }
  if (auth.profile.role === 'processor') {
    if (!auth.profile.processor_id) return [];
    const [{ data: assigned }, { data: offers }] = await Promise.all([db.from('orders').select('id').eq('processor_id', auth.profile.processor_id), db.from('processor_offers').select('order_id').eq('processor_id', auth.profile.processor_id)]);
    orderIds = [...new Set([...(assigned ?? []).map(order => order.id), ...(offers ?? []).map(offer => offer.order_id)])];
  }
  if (auth.profile.role === 'customer') { const { data } = await db.from('orders').select('id').eq('customer_user_id', auth.user.id); orderIds = (data ?? []).map(order => order.id); }
  let query = db.from('notification_log').select('id,event').eq('channel', 'in_app');
  if (auth.profile.role === 'customer') query = query.or(`recipient.eq.customer,recipient.eq.customer:${auth.user.id}`);
  else if (auth.profile.role === 'processor' && auth.profile.processor_id) query = query.or(`recipient.eq.operations,recipient.eq.processor:${auth.profile.processor_id}`);
  else query = query.eq('recipient', 'operations');
  if (orderIds) { if (!orderIds.length) return []; query = query.in('order_id', orderIds); }
  const { data } = await query;
  return (data ?? []).filter(item => auth.profile.role === 'customer' || roleCanSeeOperationalEvent(auth.profile.role, item.event)).map(item => item.id);
}

export async function GET() {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = auth.client;
  const { data: preferences } = await auth.client.from('notification_preferences').select('in_app_enabled').eq('user_id', auth.user.id).maybeSingle();
  if (preferences?.in_app_enabled === false) return NextResponse.json({ notifications: [] });
  let orderIds: string[] | null = null;
  if (auth.profile.role === 'driver') { const { data } = await db.from('orders').select('id').eq('assigned_driver_id', auth.user.id); orderIds = (data ?? []).map(order => order.id); }
  if (auth.profile.role === 'processor') { if (!auth.profile.processor_id) return NextResponse.json({ notifications: [] }); const [{ data: assigned }, { data: offers }] = await Promise.all([db.from('orders').select('id').eq('processor_id', auth.profile.processor_id), db.from('processor_offers').select('order_id').eq('processor_id', auth.profile.processor_id)]); orderIds = [...new Set([...(assigned ?? []).map(order => order.id), ...(offers ?? []).map(offer => offer.order_id)])]; }
  if (auth.profile.role === 'customer') { const { data } = await db.from('orders').select('id').eq('customer_user_id', auth.user.id); orderIds = (data ?? []).map(order => order.id); }
  if (orderIds && !orderIds.length) return NextResponse.json({ notifications: [] });
  let query = db.from('notification_log').select('id,order_id,channel,event,message,status,created_at,sent_at').eq('channel', 'in_app').order('created_at', { ascending: false }).limit(30);
  if (auth.profile.role === 'customer') query = query.or(`recipient.eq.customer,recipient.eq.customer:${auth.user.id}`);
  else if (auth.profile.role === 'processor' && auth.profile.processor_id) query = query.or(`recipient.eq.operations,recipient.eq.processor:${auth.profile.processor_id}`);
  else query = query.eq('recipient', 'operations');
  if (orderIds) query = query.in('order_id', orderIds);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const visibleData = (data ?? []).filter(item => auth.profile.role === 'customer' || roleCanSeeOperationalEvent(auth.profile.role, item.event));
  const notificationIds = visibleData.map(item => item.id);
  const [{ data: reads }, { data: dismissed }] = await Promise.all([
    notificationIds.length ? db.from('notification_reads').select('notification_id').eq('user_id', auth.user.id).in('notification_id', notificationIds) : Promise.resolve({ data: [] }),
    notificationIds.length ? db.from('notification_dismissals').select('notification_id').eq('user_id', auth.user.id).in('notification_id', notificationIds) : Promise.resolve({ data: [] }),
  ]);
  const readIds = new Set((reads ?? []).map(item => item.notification_id));
  const dismissedIds = new Set((dismissed ?? []).map(item => item.notification_id));
  return NextResponse.json({ notifications: visibleData.filter(item => !dismissedIds.has(item.id)).map(item => ({ ...item, read: readIds.has(item.id), targetSection: targetFor(auth.profile.role, item.event) })) });
}

export async function PATCH(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'A valid notification action is required.' }, { status: 400 });
  const db = auth.client;
  const visibleIds = await visibleNotificationIds(auth, db);
  const ids = parsed.data.action === 'mark_read' ? (parsed.data.notificationId && visibleIds.includes(parsed.data.notificationId) ? [parsed.data.notificationId] : []) : visibleIds;
  if (ids.length) {
    const table = parsed.data.action === 'clear_all' ? 'notification_dismissals' : 'notification_reads';
    const { error } = await db.from(table).upsert(ids.map(notificationId => ({ user_id: auth.user.id, notification_id: notificationId })), { onConflict: 'user_id,notification_id', ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ marked: ids.length });
}
