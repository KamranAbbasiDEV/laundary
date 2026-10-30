import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser } from '@/lib/api-auth';
import { logOperationalNotification } from '@/lib/notifications';

const handoffSchema = z.object({ orderId: z.string().uuid(), stage: z.enum(['customer_pickup','processor_dropoff','processor_pickup','customer_delivery']), actualBags: z.number().int().nonnegative(), discrepancy: z.string().max(1000).optional(), notes: z.string().max(1000).optional() });
const photoKindByStage = { customer_pickup: 'customer-pickup', processor_dropoff: 'processor-dropoff', processor_pickup: 'processor-pickup', customer_delivery: 'customer-delivery' } as const;
const exceptionTypeByStage = { customer_pickup: 'pickup_discrepancy', processor_dropoff: 'processor_discrepancy', processor_pickup: 'processor_discrepancy', customer_delivery: 'quality_issue' } as const;
const routeTypeByStage = { customer_pickup: 'pickup', processor_dropoff: 'processor_dropoff', processor_pickup: 'processor_pickup', customer_delivery: 'delivery' } as const;
const orderStatusByStage = { customer_pickup: 'pickup_scheduled', processor_dropoff: 'picked_up', processor_pickup: 'ready_for_pickup', customer_delivery: 'out_for_delivery' } as const;

export async function GET(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const orderId = new URL(request.url).searchParams.get('orderId');
  if (orderId && !z.string().uuid().safeParse(orderId).success) return NextResponse.json({ error: 'Invalid order id.' }, { status: 400 });
  let query = auth.client.from('order_handoffs').select('*').order('created_at');
  if (auth.profile.role === 'driver') {
    const { data: assigned } = await auth.client.from('orders').select('id').eq('assigned_driver_id', auth.user.id);
    const ids = (assigned ?? []).map(order => order.id);
    if (!ids.length) return NextResponse.json({ handoffs: [] });
    query = query.in('order_id', ids);
  }
  if (auth.profile.role === 'processor') {
    if (!auth.profile.processor_id) return NextResponse.json({ handoffs: [] });
    const { data: assigned } = await auth.client.from('orders').select('id').eq('processor_id', auth.profile.processor_id);
    const ids = (assigned ?? []).map(order => order.id);
    if (!ids.length) return NextResponse.json({ handoffs: [] });
    query = query.in('order_id', ids);
  }
  if (orderId) query = query.eq('order_id', orderId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ handoffs: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!['super_admin','dispatcher','driver'].includes(auth.profile.role)) return NextResponse.json({ error: 'Driver or dispatcher access required.' }, { status: 403 });
  const parsed = handoffSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid handoff data.', details: parsed.error.flatten() }, { status: 400 });
  const item = parsed.data;
  const { data: order, error: orderError } = await auth.client.from('orders').select('id,order_number,phone,expected_bags,assigned_driver_id,has_exception,due_at,status').eq('id', item.orderId).single();
  if (orderError || !order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (auth.profile.role === 'driver' && order.assigned_driver_id !== auth.user.id) return NextResponse.json({ error: 'You can only record handoffs for orders assigned to you.' }, { status: 403 });
  if (order.status !== orderStatusByStage[item.stage]) return NextResponse.json({ error: `This handoff is not available while the order is ${order.status.replaceAll('_', ' ')}. Refresh the route and complete the current stage first.` }, { status: 409 });
  const routeType = routeTypeByStage[item.stage];
  let stopQuery = auth.client.from('route_stops').select('id,route_id,route_plans!inner(status)').eq('order_id', item.orderId).eq('route_type', routeType).in('status', ['planned', 'arrived']).in('route_plans.status', ['approved', 'in_progress']).order('route_date', { ascending: false }).limit(1);
  if (auth.profile.role === 'driver') stopQuery = stopQuery.eq('driver_id', auth.user.id);
  const { data: stop, error: assignedStopError } = await stopQuery.maybeSingle();
  if (assignedStopError) return NextResponse.json({ error: assignedStopError.message }, { status: 500 });
  if (!stop) return NextResponse.json({ error: 'No active route stop exists for this handoff. Ask dispatch to approve or recover the route first.' }, { status: 409 });
  // Every physical transfer needs evidence. This is enforced here, not only in the UI.
  const { count: photoCount, error: photoError } = await auth.client.from('order_photos').select('id', { count: 'exact', head: true }).eq('order_id', item.orderId).eq('kind', photoKindByStage[item.stage]);
  if (photoError) return NextResponse.json({ error: photoError.message }, { status: 500 });
  if (!photoCount) return NextResponse.json({ error: 'Attach a photo for this handoff before confirming it.' }, { status: 409 });
  const { data, error } = await auth.client.from('order_handoffs').upsert({ order_id: item.orderId, stage: item.stage, expected_bags: order.expected_bags, actual_bags: item.actualBags, discrepancy: item.discrepancy ?? null, notes: item.notes ?? null, confirmed_by: auth.user.id, confirmed_at: new Date().toISOString() }, { onConflict: 'order_id,stage' }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const column = item.stage === 'customer_pickup' ? 'actual_bags' : item.stage === 'processor_dropoff' ? 'processor_bags' : item.stage === 'processor_pickup' ? 'completed_bags' : 'delivered_bags';
  // A later clean handoff must not erase an earlier discrepancy awaiting review.
  const { error: updateError } = await auth.client.from('orders').update({ [column]: item.actualBags, has_exception: order.has_exception || Boolean(item.discrepancy), updated_at: new Date().toISOString() }).eq('id', item.orderId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  let exception = null;
  if (item.discrepancy) {
    const { data: existingException, error: readExceptionError } = await auth.client.from('exceptions').select('*').eq('source_handoff_id', data.id).maybeSingle();
    if (readExceptionError) return NextResponse.json({ error: readExceptionError.message }, { status: 500 });
    const { data: insertedException, error: exceptionError } = existingException
      ? await auth.client.from('exceptions').update({ description: item.discrepancy, status: 'open', resolution_notes: null, resolved_at: null, resolved_by: null }).eq('id', existingException.id).select('*').single()
      : await auth.client.from('exceptions').insert({
          order_id: item.orderId, type: exceptionTypeByStage[item.stage], stage: item.stage, issue_code: 'quantity_mismatch', description: item.discrepancy,
          severity: 'medium', evidence_required: true, deadline_impact: order.due_at ? 'at_risk' : 'none', deadline_before: order.due_at, opened_by: auth.user.id, source_handoff_id: data.id, status: 'open'
        }).select('*').single();
    if (exceptionError) return NextResponse.json({ error: exceptionError.message }, { status: 500 });
    exception = insertedException;
    await logOperationalNotification({ orderId: item.orderId, event: 'exception_recorded', message: `${order.order_number} has a ${item.stage.replaceAll('_', ' ')} discrepancy requiring review: ${item.discrepancy}.${order.due_at ? ` Deadline: ${new Date(order.due_at).toLocaleString()}.` : ''}`, phone: order.phone }, auth.client);
  }
  // The matching order transition completes this stop atomically through
  // advance_driver_order_stage. Keeping the stop open here makes a failed
  // transition safely retryable instead of hiding unfinished work.
  return NextResponse.json({ handoff: data, exception }, { status: 201 });
}
