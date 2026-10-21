import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasRole, requireActiveUser } from '@/lib/api-auth';
import { logCustomerNotification, logOperationalNotification } from '@/lib/notifications';
import { pickupDeadlineError } from '@/lib/order-scheduling';

const updateSchema = z.object({ id: z.string().uuid(), status: z.enum(['open', 'in_review', 'resolved']), resolutionNotes: z.string().max(2000).optional(), assignedTo: z.string().uuid().nullable().optional(), deadlineImpact: z.enum(['none','at_risk','delayed']).optional(), revisedDueAt: z.string().datetime({ offset: true }).nullable().optional(), deadlineReason: z.string().trim().max(1000).optional(), customerMessage: z.string().trim().max(1000).optional(), notifyCustomer: z.boolean().optional() });
const createSchema = z.object({ orderId: z.string().uuid(), type: z.enum(['pickup_discrepancy','processor_discrepancy','quality_issue','damaged_item','route_issue','missing_customer_specification']), stage: z.string().optional(), description: z.string().trim().min(3).max(2000), severity: z.enum(['low','medium','high','critical']).default('medium') });

export async function POST(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher', 'processor'])) return NextResponse.json({ error: 'Operations access required.' }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'A valid exception description is required.' }, { status: 400 });
  const item = parsed.data;
  const { data: order, error: orderError } = await auth.client.from('orders').select('id,order_number,phone,processor_id,due_at').eq('id', item.orderId).maybeSingle();
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (auth.profile.role === 'processor' && order.processor_id !== auth.profile.processor_id) return NextResponse.json({ error: 'You can only report issues for your facility orders.' }, { status: 403 });
  const { data, error } = await auth.client.from('exceptions').insert({ order_id: item.orderId, type: item.type, stage: item.stage ?? null, description: item.description, severity: item.severity, deadline_impact: order.due_at ? 'at_risk' : 'none', deadline_before: order.due_at, opened_by: auth.user.id, status: 'open' }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { error: orderUpdateError } = await auth.client.from('orders').update({ has_exception: true, updated_at: new Date().toISOString() }).eq('id', item.orderId);
  if (orderUpdateError) return NextResponse.json({ error: orderUpdateError.message }, { status: 500 });
  await logOperationalNotification({ orderId: item.orderId, event: 'exception_recorded', message: `${order.order_number} requires review: ${item.description}.${order.due_at ? ` Deadline: ${new Date(order.due_at).toLocaleString()}.` : ''}`, phone: order.phone });
  return NextResponse.json({ exception: data }, { status: 201 });
}

export async function GET(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher', 'processor'])) return NextResponse.json({ error: 'Operations access required.' }, { status: 403 });
  const status = new URL(request.url).searchParams.get('status');
  let query = auth.client.from('exceptions').select('*,orders(order_number,customer_name,status,processor_id)').order('created_at', { ascending: false });
  if (status === 'active') query = query.neq('status', 'resolved');
  else if (status && ['open', 'in_review', 'resolved'].includes(status)) query = query.eq('status', status);
  if (auth.profile.role === 'processor') {
    if (!auth.profile.processor_id) return NextResponse.json({ exceptions: [] });
    const { data: scopedOrders } = await auth.client.from('orders').select('id').eq('processor_id', auth.profile.processor_id);
    const ids = (scopedOrders ?? []).map((order) => order.id);
    if (!ids.length) return NextResponse.json({ exceptions: [] });
    query = query.in('order_id', ids);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ exceptions: data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher'])) return NextResponse.json({ error: 'Dispatcher access required.' }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid exception update.', details: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;
  if (body.status === 'resolved' && !body.resolutionNotes?.trim()) return NextResponse.json({ error: 'A resolution note is required when resolving an exception.' }, { status: 400 });
  const { data: current, error: currentError } = await auth.client.from('exceptions').select('id,order_id,status,deadline_impact,deadline_before,deadline_after,deadline_reason,customer_message,customer_notified_at,customer_notified_by,resolution_notes').eq('id', body.id).single();
  if (currentError || !current) return NextResponse.json({ error: currentError?.message || 'Exception not found.' }, { status: currentError ? 500 : 404 });
  const { data: order } = await auth.client.from('orders').select('id,order_number,phone,due_at,original_due_at,pickup_window_start_at,pickup_window_end_at').eq('id', current.order_id).single();
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (body.assignedTo) {
    const { data: assignee, error: assigneeError } = await auth.client.from('profiles').select('id,role,status').eq('id', body.assignedTo).maybeSingle();
    if (assigneeError) return NextResponse.json({ error: assigneeError.message }, { status: 500 });
    if (!assignee || assignee.status !== 'active' || !['super_admin', 'dispatcher'].includes(assignee.role)) return NextResponse.json({ error: 'Exceptions can only be assigned to an active dispatcher or Super Admin.' }, { status: 400 });
  }
  const deadlineImpact = body.deadlineImpact ?? (body.revisedDueAt ? 'delayed' : undefined);
  if (body.revisedDueAt && !body.deadlineReason?.trim()) return NextResponse.json({ error: 'A reason is required when revising the deadline.' }, { status: 400 });
  const pickupError = pickupDeadlineError({ pickupStartAt: order.pickup_window_start_at, pickupEndAt: order.pickup_window_end_at, deadlineAt: body.revisedDueAt ?? order.due_at });
  if (pickupError) return NextResponse.json({ error: pickupError }, { status: 400 });
  const { data, error } = await auth.client.from('exceptions').update({
    status: body.status, ...(body.assignedTo !== undefined ? { assigned_to: body.assignedTo } : {}), resolution_notes: body.resolutionNotes?.trim() || current.resolution_notes || null,
    deadline_impact: deadlineImpact ?? current.deadline_impact ?? 'none', deadline_before: current.deadline_before ?? order.due_at, deadline_after: body.revisedDueAt !== undefined ? body.revisedDueAt : current.deadline_after ?? null, deadline_reason: body.deadlineReason !== undefined ? body.deadlineReason?.trim() || null : current.deadline_reason ?? null,
    customer_message: body.customerMessage !== undefined ? body.customerMessage?.trim() || null : current.customer_message ?? null,
    customer_notified_at: body.notifyCustomer && body.customerMessage?.trim() ? new Date().toISOString() : current.customer_notified_at ?? null,
    customer_notified_by: body.notifyCustomer && body.customerMessage?.trim() ? auth.user.id : current.customer_notified_by ?? null,
    resolved_at: body.status === 'resolved' ? new Date().toISOString() : null, resolved_by: body.status === 'resolved' ? auth.user.id : null
  }).eq('id', body.id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (body.status === 'resolved') {
    const { count } = await auth.client.from('exceptions').select('id', { count: 'exact', head: true }).eq('order_id', data.order_id).neq('status', 'resolved');
    if (!count) {
      const { error: orderUpdateError } = await auth.client.from('orders').update({ has_exception: false, updated_at: new Date().toISOString() }).eq('id', data.order_id);
      if (orderUpdateError) return NextResponse.json({ error: orderUpdateError.message }, { status: 500 });
    }
  }
  if (body.revisedDueAt) {
    const { error: deadlineUpdateError } = await auth.client.from('orders').update({ due_at: body.revisedDueAt, original_due_at: order.original_due_at ?? order.due_at ?? current.deadline_before, deadline_revised_at: new Date().toISOString(), deadline_revised_by: auth.user.id, deadline_revision_reason: body.deadlineReason?.trim() || null, customer_exception_message: body.customerMessage?.trim() || null, ...(body.notifyCustomer && body.customerMessage?.trim() ? { customer_exception_notified_at: new Date().toISOString() } : {}), updated_at: new Date().toISOString() }).eq('id', current.order_id);
    if (deadlineUpdateError) return NextResponse.json({ error: deadlineUpdateError.message }, { status: 500 });
    const { error: historyError } = await auth.client.from('deadline_revisions').insert({
      order_id: current.order_id,
      previous_original_due_at: order.original_due_at ?? order.due_at ?? current.deadline_before,
      original_due_at: order.original_due_at ?? order.due_at ?? current.deadline_before,
      previous_committed_due_at: order.due_at,
      committed_due_at: body.revisedDueAt,
      reason: body.deadlineReason?.trim() || null,
      changed_by: auth.user.id
    });
    if (historyError) return NextResponse.json({ error: historyError.message }, { status: 500 });
  } else if (body.customerMessage?.trim()) {
    const { error: messageUpdateError } = await auth.client.from('orders').update({ customer_exception_message: body.customerMessage.trim(), ...(body.notifyCustomer ? { customer_exception_notified_at: new Date().toISOString() } : {}), updated_at: new Date().toISOString() }).eq('id', current.order_id);
    if (messageUpdateError) return NextResponse.json({ error: messageUpdateError.message }, { status: 500 });
  }
  const deadline = body.revisedDueAt ?? order.due_at;
  const statusText = body.status === 'resolved' ? 'resolved' : body.status === 'in_review' ? 'assigned for review' : 'updated';
  await logOperationalNotification({ orderId: order.id, event: body.status === 'resolved' ? 'exception_resolved' : 'exception_updated', message: `${order.order_number} exception ${statusText}.${deadline ? ` Deadline: ${new Date(deadline).toLocaleString()}.` : ''}`, phone: order.phone });
  if (body.notifyCustomer && body.customerMessage?.trim()) await logCustomerNotification({ orderId: order.id, event: 'customer_exception_update', message: body.customerMessage.trim(), phone: order.phone });
  return NextResponse.json({ exception: data });
}
