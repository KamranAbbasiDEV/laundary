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
  const detailClient = supabaseAdmin ?? auth.client;
  const [events, handoffs, photos, exceptions, offers, stops] = await Promise.all([
    auth.client.from('order_events').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    auth.client.from('order_handoffs').select('*').eq('order_id', id).order('confirmed_at', { ascending: false }),
    detailClient.from('order_photos').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    detailClient.from('exceptions').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    auth.client.from('processor_offers').select('id,rank,score,score_breakdown,status,rejection_reason,offered_at,responded_at,processors(name)').eq('order_id', id).order('rank'),
    auth.client.from('route_stops').select('id,route_id,route_date,route_type,sequence,status,checked_in_at,completed_at,failure_reason,dispatcher_note').eq('order_id', id).order('route_date', { ascending: false })
  ]);
  const failed = [events, handoffs, photos, exceptions, offers, stops].find((result) => result.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });
  const photosWithUrls = await Promise.all((photos.data ?? []).map(async (photo) => {
    if (!supabaseAdmin) return photo;
    const { data } = await supabaseAdmin.storage.from('order-photos').createSignedUrl(photo.storage_path, 3600);
    return { ...photo, url: data?.signedUrl ?? null };
  }));
  const visibleExceptions = auth.profile.role === 'customer'
    ? (exceptions.data ?? []).filter(item => item.customer_message || item.status !== 'resolved').map(item => ({ id: item.id, status: item.status, deadline_impact: item.deadline_impact, deadline_after: item.deadline_after, customer_message: item.customer_message, customer_notified_at: item.customer_notified_at, created_at: item.created_at }))
    : exceptions.data ?? [];
  return NextResponse.json({ order, events: events.data ?? [], handoffs: handoffs.data ?? [], photos: photosWithUrls, exceptions: visibleExceptions, offers: offers.data ?? [], routeStops: stops.data ?? [] });
}
