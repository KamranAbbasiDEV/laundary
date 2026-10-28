import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getUserSafely } from '@/lib/supabase-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { inngest } from '@/lib/inngest';
import { logCustomerNotification, logOperationalNotification } from '@/lib/notifications';
import { getDeadlineStatus, formatDeadlineDelta } from '@/lib/deadlines';
import { pickupDeadlineError } from '@/lib/order-scheduling';
import { serviceIsConfigured } from '@/lib/service-catalog';

const orderInput = z.object({
  customer: z.string().min(2), phone: z.string().min(7), address: z.string().min(5),
  service: z.string().min(1), bags: z.number().int().positive(), due: z.string().min(1), dueAt: z.string().datetime({ offset: true }), pickupWindowStartAt: z.string().datetime({ offset: true }).optional(), pickupWindowEndAt: z.string().datetime({ offset: true }).optional(), notes: z.string().optional(),
  items: z.string().max(2000).optional(), textileTypes: z.array(z.string().min(1).max(80)).max(12).optional(), specialHandling: z.array(z.string().min(1).max(120)).max(12).optional(), customerSpecifications: z.string().max(4000).optional(), priority: z.enum(['standard', 'priority', 'same_day']).optional()
});

function mapOrder(row:Record<string,unknown>, processorName?: string, role?: string, exceptionDetail?: { description?: string; severity?: string; deadline_impact?: string; customer_notified_at?: string | null } | null, completionAt?: string, routeDetail?: { active?: boolean; failed?: boolean } | null, timezone = 'UTC') {
  const statusMap:Record<string,string> = { created:'Created', validated:'Validated', processor_ranked:'Processor ranked', capacity_confirmed:'Capacity confirmed', pickup_scheduled:'Pickup scheduled', picked_up:'Picked up', at_processor:'At processor', processing:'Processing', ready_for_pickup:'Ready for pickup', picked_up_from_processor:'Picked up from processor', qc_reconciliation:'QC / Reconciliation', out_for_delivery:'Out for delivery', delivered:'Delivered', processor_reviewed:'Processor reviewed' };
  const priorityMap:Record<string,string> = { standard:'Standard', priority:'Priority', same_day:'Same day' };
  const deadline = typeof row.due_at === 'string' ? row.due_at : undefined;
  const deadlineLabel = deadline ? new Date(deadline).toLocaleString() : '';
  const due = [row.due_at_label ?? '', deadlineLabel ? `deadline ${deadlineLabel}` : ''].filter(Boolean).join(' · ');
  const status = statusMap[String(row.status)] ?? row.status as string;
  const atRisk = Boolean(routeDetail?.failed) || exceptionDetail?.deadline_impact === 'at_risk' || exceptionDetail?.deadline_impact === 'delayed' || (role === 'customer' && Boolean(row.has_exception));
  const deadlineStatus = getDeadlineStatus({ deadline, actualCompletionAt: completionAt, orderStatus: status, atRisk, timezone });
  const isCustomer = role === 'customer';
  return { id:row.order_number ?? row.id, internalId:row.id, customer:row.customer_name, phone:row.phone, address:row.pickup_address, service:row.service_type, items:row.item_description ?? '', bags:row.expected_bags, due, pickupWindow:row.due_at_label ?? undefined, pickupWindowStartAt:row.pickup_window_start_at ?? undefined, pickupWindowEndAt:row.pickup_window_end_at ?? undefined, deadline, originalDeadline:isCustomer ? undefined : row.original_due_at ?? deadline, deadlineRevisionReason:isCustomer ? undefined : row.deadline_revision_reason ?? undefined, deadlineStatus, deadlineDelta:formatDeadlineDelta(deadline), actualCompletionAt:isCustomer ? undefined : completionAt, routeAssigned:isCustomer ? undefined : routeDetail?.active ?? false, failedStop:isCustomer ? undefined : routeDetail?.failed ?? false, customerNotificationPending:isCustomer ? undefined : Boolean(row.customer_exception_message && !row.customer_exception_notified_at), status:status as never, processor:isCustomer ? 'Operations team' : processorName ?? 'Unassigned', priority:priorityMap[String(row.priority)] ?? row.priority, created:row.created_at, notes:isCustomer ? undefined : row.notes ?? undefined, actualBags:isCustomer ? undefined : row.actual_bags ?? undefined, processorBags:isCustomer ? undefined : row.processor_bags ?? undefined, completedBags:isCustomer ? undefined : row.completed_bags ?? undefined, exception:row.has_exception ? isCustomer ? 'Open exception' : exceptionDetail?.description ?? 'Open exception' : undefined, exceptionMessage:row.customer_exception_message ?? undefined, archived:Boolean(row.archived_at) };
}

export async function GET(request: Request) {
  const client = await createSupabaseServerClient();
  if (!client) return NextResponse.json({ error:'Supabase is not configured' }, { status:503 });
  const { data:{ user } } = await getUserSafely(client);
  if (!user) return NextResponse.json({ error:'Authentication required' }, { status:401 });
  const { data:profile } = await client.from('profiles').select('role,processor_id,driver_id').eq('id',user.id).single();
  if (!profile) return NextResponse.json({ error: 'Workspace profile not found.' }, { status: 403 });
  let query = client.from('orders').select('*').order('created_at', { ascending:false });
  if (profile.role === 'customer') query = query.eq('customer_user_id', user.id);
  if (profile.role === 'processor') {
    if (!profile.processor_id) return NextResponse.json({ orders: [] });
    query = query.eq('processor_id', profile.processor_id);
  }
  if (profile.role === 'driver') query = query.eq('assigned_driver_id', user.id);
  if (profile.role !== 'super_admin') query = query.is('archived_at', null);
  const rawSearch = new URL(request.url).searchParams.get('q')?.trim().slice(0, 80);
  const search = rawSearch?.replace(/[\\%(),]/g, ' ').replace(/\s+/g, ' ').trim();
  if (search) query = query.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%,phone.ilike.%${search}%,pickup_address.ilike.%${search}%,service_type.ilike.%${search}%,item_description.ilike.%${search}%`).limit(20);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error:error.message }, { status:500 });
  const { data: workspace } = await client.from('workspace_settings').select('timezone').eq('id', 'default').maybeSingle();
  const timezone = workspace?.timezone || 'UTC';
  const rows = data ?? [];
  const exceptionByOrder = new Map<string, { description?: string; severity?: string; deadline_impact?: string; customer_notified_at?: string | null }>();
  const impactRank: Record<string, number> = { none: 0, at_risk: 1, delayed: 2 };
  const completionByOrder = new Map<string, string>();
  const routeByOrder = new Map<string, { active: boolean; failed: boolean }>();
  if (rows.length) {
    const [{ data: events, error: eventsError }, { data: stops, error: stopsError }] = await Promise.all([
      client.from('order_events').select('order_id,created_at,to_status').in('order_id', rows.map(row => row.id)).eq('to_status', 'delivered').order('created_at', { ascending: true }),
      client.from('route_stops').select('order_id,status').in('order_id', rows.map(row => row.id))
    ]);
    if (eventsError || stopsError) return NextResponse.json({ error: eventsError?.message || stopsError?.message || 'Unable to load deadline completion data.' }, { status: 500 });
    (events ?? []).forEach(event => { if (!completionByOrder.has(event.order_id)) completionByOrder.set(event.order_id, event.created_at); });
    (stops ?? []).forEach(stop => { const current = routeByOrder.get(stop.order_id) ?? { active: false, failed: false }; current.active = current.active || ['planned', 'arrived'].includes(stop.status); current.failed = current.failed || stop.status === 'failed'; routeByOrder.set(stop.order_id, current); });
  }
  if (rows.length && profile.role !== 'customer') {
    const { data: exceptionRows, error: exceptionError } = await client.from('exceptions').select('order_id,description,severity,deadline_impact,customer_notified_at').in('order_id', rows.map(row => row.id)).neq('status', 'resolved').order('created_at', { ascending: false });
    if (exceptionError) return NextResponse.json({ error: exceptionError.message }, { status: 500 });
    (exceptionRows ?? []).forEach(exception => {
      const current = exceptionByOrder.get(exception.order_id);
      if (!current || (impactRank[exception.deadline_impact ?? 'none'] ?? 0) > (impactRank[current.deadline_impact ?? 'none'] ?? 0)) exceptionByOrder.set(exception.order_id, exception);
    });
  }
  const processorNames = new Map<string, string>();
  if (profile?.role && profile.role !== 'customer') {
    const processorIds = [...new Set(rows.map(row => row.processor_id).filter((id): id is string => typeof id === 'string'))];
    if (processorIds.length) {
      const { data: processorRows } = await client.from('processors').select('id,name').in('id', processorIds);
      (processorRows ?? []).forEach(processor => processorNames.set(processor.id, processor.name));
    }
  }
  return NextResponse.json({ orders: rows.map(row => mapOrder(row, typeof row.processor_id === 'string' ? processorNames.get(row.processor_id) : undefined, profile.role, exceptionByOrder.get(row.id) ?? null, completionByOrder.get(row.id), routeByOrder.get(row.id) ?? null, timezone)), timezone });
}

export async function POST(request: Request) {
  const parsed = orderInput.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid order payload', details: parsed.error.flatten() }, { status: 400 });
  const pickupError = pickupDeadlineError({ pickupStartAt: parsed.data.pickupWindowStartAt, pickupEndAt: parsed.data.pickupWindowEndAt, deadlineAt: parsed.data.dueAt });
  if (pickupError) return NextResponse.json({ error: pickupError }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error:'Supabase is not configured' }, { status:503 });
  const { data: { user } } = await getUserSafely(supabase);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { data:profile } = await supabase.from('profiles').select('role,status').eq('id',user.id).single();
  if (!profile || profile.status !== 'active' || !['super_admin', 'dispatcher', 'customer'].includes(profile.role)) return NextResponse.json({ error: 'Your account cannot create orders.' }, { status: 403 });
  const matchingClient = supabaseAdmin ?? supabase;
  const { data: workspace } = await matchingClient.from('workspace_settings').select('services,matching_rules').eq('id', 'default').maybeSingle();
  if (!serviceIsConfigured(parsed.data.service, workspace?.services)) return NextResponse.json({ error: 'Choose a service from the active workspace service catalog.' }, { status: 400 });

  const needsManualReview = profile.role === 'customer';
  const { data, error } = await supabase.from('orders').insert({
    customer_name: parsed.data.customer, phone: parsed.data.phone, pickup_address: parsed.data.address,
    service_type: parsed.data.service, expected_bags: parsed.data.bags, due_at_label: parsed.data.due, due_at: parsed.data.dueAt, original_due_at: parsed.data.dueAt, pickup_window_start_at: parsed.data.pickupWindowStartAt ?? null, pickup_window_end_at: parsed.data.pickupWindowEndAt ?? null,
    notes: parsed.data.notes ?? null, item_description: parsed.data.items ?? null, textile_types: parsed.data.textileTypes ?? [], special_handling: parsed.data.specialHandling ?? [], customer_specifications: parsed.data.customerSpecifications ?? null, priority: parsed.data.priority ?? 'standard', validation_state: needsManualReview ? 'manual_review' : 'validated', validated_at: needsManualReview ? null : new Date().toISOString(), validated_by: needsManualReview ? null : user.id, status: needsManualReview ? 'created' : 'validated', customer_user_id: profile?.role === 'customer' ? user.id : null
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logOperationalNotification({ orderId: data.id, event: 'order_created', message: `${data.order_number} was created and is ready for validation and processor matching. Deadline: ${new Date(data.due_at).toLocaleString()}.`, phone: data.phone });
  if (profile.role === 'customer') await logCustomerNotification({ orderId: data.id, event: 'order_received', message: `We received order ${data.order_number}. We are reviewing the details and will begin matching it with a laundry partner.`, phone: data.phone, customerUserId: user.id });
  if (needsManualReview) return NextResponse.json({ order: data, persistence: 'supabase', reviewRequired: true }, { status: 201 });
  const defaultWeights = { capability: 30, capacity: 20, turnaround: 15, pricing: 10, performance: 5 };
  const configuredWeights = workspace?.matching_rules && typeof workspace.matching_rules === 'object' && !Array.isArray(workspace.matching_rules) ? workspace.matching_rules as Record<string, unknown> : {};
  const weights = { ...defaultWeights, ...Object.fromEntries(Object.entries(configuredWeights).filter(([, value]) => typeof value === 'number' && value >= 0)) } as Record<string, number>;
  const { data: candidates } = await matchingClient.from('processors').select('id,capabilities,pricing,capacity_limit,capacity_percent,turnaround_hours,performance_score').eq('active', true);
  if (candidates?.length) {
    const service = parsed.data.service.toLowerCase();
    const ranked = candidates.map(candidate => {
      const capabilities = Array.isArray(candidate.capabilities) ? candidate.capabilities.map(value => String(value).toLowerCase()) : [];
      const capabilityScore = capabilities.some(value => service.includes(value) || value.includes(service)) ? weights.capability : 0;
      const capacityScore = Number(candidate.capacity_limit) > 0 && Number(candidate.capacity_percent) < 100 ? weights.capacity : 0;
      const turnaroundHours = Number(candidate.turnaround_hours ?? 0);
      const turnaroundScore = turnaroundHours > 0 ? Math.max(0, weights.turnaround * (1 - Math.min(turnaroundHours, 96) / 96)) : 0;
      const pricingScore = candidate.pricing ? weights.pricing : 0;
      const performanceScore = Math.max(0, Math.min(100, Number(candidate.performance_score ?? 0))) / 100 * weights.performance;
      const scoreBreakdown = { capability: capabilityScore, capacity: capacityScore, turnaround: turnaroundScore, pricing: pricingScore, performance: performanceScore };
      return { id: candidate.id, score: capabilityScore + capacityScore + turnaroundScore + pricingScore + performanceScore, turnaround: turnaroundHours || 999, scoreBreakdown };
    }).sort((a, b) => b.score - a.score || a.turnaround - b.turnaround);
    const { error: offerError } = await matchingClient.from('processor_offers').insert(ranked.map((candidate, index) => ({ order_id: data.id, processor_id: candidate.id, rank: index + 1, score: candidate.score, score_breakdown: candidate.scoreBreakdown, expires_at: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(), status: index === 0 ? 'pending' : 'withdrawn' })));
    if (offerError) return NextResponse.json({ order: data, persistence: 'supabase', warning: `Order was created but processor matching needs dispatcher attention: ${offerError.message}` }, { status: 201 });
    const { error: statusError } = await matchingClient.from('orders').update({ status: 'processor_ranked', updated_at: new Date().toISOString() }).eq('id', data.id);
    if (statusError) return NextResponse.json({ order: data, persistence: 'supabase', warning: `Order was created but could not enter matching: ${statusError.message}` }, { status: 201 });
    data.status = 'processor_ranked';
  }
  if (process.env.INNGEST_EVENT_KEY) {
    try { await inngest.send({ name: 'rinseline/order.validated', data: { orderId: data.id } }); } catch (eventError) { console.error('Unable to queue processor notification', eventError); }
  }
  return NextResponse.json({ order: data, persistence: 'supabase' }, { status: 201 });
}
