import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

const idSchema = z.string().uuid();

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: 'Invalid order id.' }, { status: 400 });
  const { data: order, error } = await auth.client.from('orders').select('*').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (auth.profile.role === 'driver' && order.assigned_driver_id !== auth.user.id) return NextResponse.json({ error: 'You can only inspect orders assigned to you.' }, { status: 403 });
  if (auth.profile.role === 'processor' && order.processor_id !== auth.profile.processor_id) return NextResponse.json({ error: 'You can only inspect orders assigned to your facility.' }, { status: 403 });
  const detailClient = supabaseAdmin ?? auth.client;
  const [events, handoffs, photos, exceptions, offers, stops, deadlineRevisions] = await Promise.all([
    auth.client.from('order_events').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    auth.client.from('order_handoffs').select('*').eq('order_id', id).order('confirmed_at', { ascending: false }),
    detailClient.from('order_photos').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    detailClient.from('exceptions').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    auth.client.from('processor_offers').select('id,rank,score,score_breakdown,status,rejection_reason,offered_at,responded_at,processors(name)').eq('order_id', id).order('rank'),
    auth.client.from('route_stops').select('id,route_id,route_date,route_type,sequence,status,checked_in_at,completed_at,failure_reason,dispatcher_note').eq('order_id', id).order('route_date', { ascending: false }),
    auth.profile.role === 'customer' ? Promise.resolve({ data: [], error: null }) : auth.client.from('deadline_revisions').select('id,previous_original_due_at,original_due_at,previous_committed_due_at,committed_due_at,reason,changed_at').eq('order_id', id).order('changed_at', { ascending: false })
  ]);
  const failed = [events, handoffs, photos, exceptions, offers, stops, deadlineRevisions].find((result) => result.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });
  const photosWithUrls = auth.profile.role === 'customer' ? [] : await Promise.all((photos.data ?? []).map(async (photo) => {
    if (!supabaseAdmin) return photo;
    const { data } = await supabaseAdmin.storage.from('order-photos').createSignedUrl(photo.storage_path, 3600);
    return { ...photo, url: data?.signedUrl ?? null };
  }));
  const visibleExceptions = auth.profile.role === 'customer'
    ? (exceptions.data ?? []).filter(item => item.customer_message || item.status !== 'resolved').map(item => ({ id: item.id, status: item.status, deadline_impact: item.deadline_impact, deadline_after: item.deadline_after, customer_message: item.customer_message, customer_notified_at: item.customer_notified_at, created_at: item.created_at }))
    : auth.profile.role === 'driver' || auth.profile.role === 'processor'
      ? (exceptions.data ?? []).map(item => ({ id: item.id, status: item.status, deadline_impact: item.deadline_impact, deadline_after: item.deadline_after, customer_message: item.customer_message, customer_notified_at: item.customer_notified_at, created_at: item.created_at }))
      : exceptions.data ?? [];
  const safeOrder = auth.profile.role === 'customer'
    ? { id: order.id, order_number: order.order_number, customer_name: order.customer_name, pickup_address: order.pickup_address, service_type: order.service_type, expected_bags: order.expected_bags, due_at: order.due_at, due_at_label: order.due_at_label, pickup_window_start_at: order.pickup_window_start_at, pickup_window_end_at: order.pickup_window_end_at, status: order.status, created_at: order.created_at }
    : order;
  const safeEvents = auth.profile.role === 'customer'
    ? (events.data ?? []).map(item => ({ id: item.id, order_id: item.order_id, from_status: item.from_status, to_status: item.to_status, created_at: item.created_at }))
    : events.data ?? [];
  return NextResponse.json({ order: safeOrder, events: safeEvents, handoffs: auth.profile.role === 'customer' ? [] : handoffs.data ?? [], photos: photosWithUrls, exceptions: visibleExceptions, offers: ['super_admin', 'dispatcher'].includes(auth.profile.role) ? offers.data ?? [] : [], routeStops: ['super_admin', 'dispatcher', 'driver'].includes(auth.profile.role) ? stops.data ?? [] : [], deadlineRevisions: ['super_admin', 'dispatcher'].includes(auth.profile.role) ? deadlineRevisions.data ?? [] : [] });
}
