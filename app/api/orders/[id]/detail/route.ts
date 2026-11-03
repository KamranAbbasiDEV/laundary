import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser } from '@/lib/api-auth';

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
  const detailClient = auth.client;
  const [events, handoffs, photos, exceptions, offers, stops, deadlineRevisions] = await Promise.all([
    auth.client.from('order_events').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    auth.client.from('order_handoffs').select('*').eq('order_id', id).order('confirmed_at', { ascending: false }),
    auth.client.from('order_photos').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    detailClient.from('exceptions').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    auth.client.from('processor_offers').select('id,rank,score,score_breakdown,status,rejection_reason,offered_at,responded_at,processors(name)').eq('order_id', id).order('rank'),
    auth.client.from('route_stops').select('id,route_id,route_date,route_type,sequence,status,driver_id,checked_in_at,completed_at,failure_reason,dispatcher_note,route_plans(id,status,route_type,route_date,driver_id)').eq('order_id', id).order('route_date', { ascending: false }),
    auth.profile.role === 'customer' ? Promise.resolve({ data: [], error: null }) : auth.client.from('deadline_revisions').select('id,previous_original_due_at,original_due_at,previous_committed_due_at,committed_due_at,reason,changed_at').eq('order_id', id).order('changed_at', { ascending: false })
  ]);
  const failed = [events, handoffs, photos, exceptions, offers, stops, deadlineRevisions].find((result) => result.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });
  const routeStops = stops.data ?? [];
  const driverIds = [...new Set(routeStops.flatMap(stop => {
    const plan = Array.isArray(stop.route_plans) ? stop.route_plans[0] : stop.route_plans;
    return [stop.driver_id, plan?.driver_id].filter((driverId): driverId is string => Boolean(driverId));
  }))];
  const { data: drivers, error: driversError } = driverIds.length ? await detailClient.from('profiles').select('id,full_name').in('id', driverIds) : { data: [], error: null };
  if (driversError) return NextResponse.json({ error: driversError.message }, { status: 500 });
  const driverNames = new Map((drivers ?? []).map(driver => [driver.id, driver.full_name]));
  const routeStopsWithDrivers = routeStops.map(stop => {
    const plan = Array.isArray(stop.route_plans) ? stop.route_plans[0] : stop.route_plans;
    const driverId = stop.driver_id ?? plan?.driver_id;
    return { ...stop, driver_name: driverId ? driverNames.get(driverId) ?? 'Assigned driver' : null };
  });
  const photosWithUrls = auth.profile.role === 'customer' ? [] : (photos.data ?? []).map((photo) => ({
    ...photo,
    // Keep the storage path private. The authenticated image endpoint streams it
    // after checking the same order access rules as this detail endpoint.
    url: `/api/photos/${photo.id}`,
    previewError: null
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
  return NextResponse.json({ order: safeOrder, events: safeEvents, handoffs: auth.profile.role === 'customer' ? [] : handoffs.data ?? [], photos: photosWithUrls, exceptions: visibleExceptions, offers: ['super_admin', 'dispatcher'].includes(auth.profile.role) ? offers.data ?? [] : [], routeStops: ['super_admin', 'dispatcher', 'driver'].includes(auth.profile.role) ? routeStopsWithDrivers : [], deadlineRevisions: ['super_admin', 'dispatcher'].includes(auth.profile.role) ? deadlineRevisions.data ?? [] : [] });
}
