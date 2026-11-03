import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getUserSafely } from '@/lib/supabase-auth';
import { logOperationalNotification } from '@/lib/notifications';
import { getDeadlineStatus, formatDeadlineDelta } from '@/lib/deadlines';
import { orderWindowError } from '@/lib/order-scheduling';
import { serviceIsConfigured } from '@/lib/service-catalog';

const orderInput = z.object({
  customerAccountId: z.string().uuid(), customer: z.string().min(2), phone: z.string().min(7), customerEmail: z.string().email().or(z.literal('')).optional(),
  pickupAddress: z.string().min(5), pickupLatitude: z.number().min(-90).max(90).nullable().optional(), pickupLongitude: z.number().min(-180).max(180).nullable().optional(),
  deliveryAddress: z.string().min(5), deliveryLatitude: z.number().min(-90).max(90).nullable().optional(), deliveryLongitude: z.number().min(-180).max(180).nullable().optional(),
  services: z.array(z.string().min(1)).min(1).max(12).refine(values => new Set(values.map(value => value.trim().toLowerCase())).size === values.length, 'Services must be unique.'), bags: z.number().int().positive(), due: z.string().min(1), dueAt: z.string().datetime({ offset: true }), pickupWindowStartAt: z.string().datetime({ offset: true }), pickupWindowEndAt: z.string().datetime({ offset: true }), deliveryWindowStartAt: z.string().datetime({ offset: true }), deliveryWindowEndAt: z.string().datetime({ offset: true }), notes: z.string().optional(),
  items: z.string().max(2000).optional(), textileTypes: z.array(z.string().min(1).max(80)).max(12).optional(), specialHandling: z.array(z.string().min(1).max(120)).max(12).optional(), customerSpecifications: z.string().max(4000).optional(), priority: z.enum(['standard', 'priority', 'same_day']).optional()
});

function mapOrder(row:Record<string,unknown>, processor?: { name: string; address: string | null }, role?: string, exceptionDetail?: { description?: string; severity?: string; deadline_impact?: string; customer_notified_at?: string | null } | null, completionAt?: string, routeDetail?: { active?: boolean; draft?: boolean; failed?: boolean } | null, timezone = 'UTC', serviceNames?: string[]) {
  const statusMap:Record<string,string> = { created:'Created', validated:'Validated', processor_ranked:'Processor ranked', capacity_confirmed:'Capacity confirmed', pickup_scheduled:'Pickup scheduled', picked_up:'Picked up', at_processor:'At processor', processing:'Processing', ready_for_pickup:'Ready for pickup', picked_up_from_processor:'Picked up from processor', qc_reconciliation:'QC / Reconciliation', out_for_delivery:'Out for delivery', delivered:'Delivered', processor_reviewed:'Processor reviewed' };
  const priorityMap:Record<string,string> = { standard:'Standard', priority:'Priority', same_day:'Same day' };
  const deadline = typeof row.due_at === 'string' ? row.due_at : undefined;
  const deadlineLabel = deadline ? new Date(deadline).toLocaleString() : '';
  const due = [row.due_at_label ?? '', deadlineLabel ? `deadline ${deadlineLabel}` : ''].filter(Boolean).join(' · ');
  const status = statusMap[String(row.status)] ?? row.status as string;
  const atRisk = Boolean(routeDetail?.failed) || exceptionDetail?.deadline_impact === 'at_risk' || exceptionDetail?.deadline_impact === 'delayed' || (role === 'customer' && Boolean(row.has_exception));
  const deadlineStatus = getDeadlineStatus({ deadline, actualCompletionAt: completionAt, orderStatus: status, atRisk, timezone });
  const isCustomer = role === 'customer';
  const validationState = String(row.validation_state ?? 'validated') as 'validated' | 'manual_review' | 'resolved';
  const services = serviceNames?.map(value => value.trim()).filter(Boolean) ?? String(row.service_type ?? '').split(',').map(value => value.trim()).filter(Boolean);
  return {
    id: row.order_number ?? row.id, internalId: row.id, customer: row.customer_name, phone: row.phone,
    address: row.pickup_address, deliveryAddress: row.customer_delivery_address ?? row.pickup_address,
    service: services.join(', '), services,
    items: row.item_description ?? '', bags: row.expected_bags, due, pickupWindow: row.due_at_label ?? undefined,
    pickupWindowStartAt: row.pickup_window_start_at ?? undefined, pickupWindowEndAt: row.pickup_window_end_at ?? undefined,
    deliveryWindowStartAt: row.delivery_window_start_at ?? undefined, deliveryWindowEndAt: row.delivery_window_end_at ?? undefined,
    deadline, originalDeadline: isCustomer ? undefined : row.original_due_at ?? deadline,
    deadlineRevisionReason: isCustomer ? undefined : row.deadline_revision_reason ?? undefined,
    deadlineStatus, deadlineDelta: formatDeadlineDelta(deadline), actualCompletionAt: isCustomer ? undefined : completionAt,
    routeAssigned: isCustomer ? undefined : routeDetail?.active ?? false,
    routeDrafted: isCustomer ? undefined : routeDetail?.draft ?? false,
    failedStop: isCustomer ? undefined : routeDetail?.failed ?? false,
    requiresValidation: isCustomer ? undefined : status === 'Created' || (status === 'Validated' && validationState === 'manual_review'),
    validationState: isCustomer ? undefined : validationState,
    customerNotificationPending: isCustomer ? undefined : Boolean(row.customer_exception_message && !row.customer_exception_notified_at),
    status: status as never, processor: isCustomer ? 'Operations team' : processor?.name ?? 'Unassigned',
    processorAddress: isCustomer ? undefined : processor?.address ?? undefined,
    priority: priorityMap[String(row.priority)] ?? row.priority, created: row.created_at,
    notes: isCustomer ? undefined : row.notes ?? undefined, actualBags: isCustomer ? undefined : row.actual_bags ?? undefined,
    processorBags: isCustomer ? undefined : row.processor_bags ?? undefined,
    completedBags: isCustomer ? undefined : row.completed_bags ?? undefined,
    exception: row.has_exception ? isCustomer ? 'Open exception' : exceptionDetail?.description ?? 'Open exception' : undefined,
    exceptionMessage: row.customer_exception_message ?? undefined, archived: Boolean(row.archived_at)
  };
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
  const routeByOrder = new Map<string, { active: boolean; draft: boolean; failed: boolean }>();
  const servicesByOrder = new Map<string, string[]>();
  if (rows.length) {
    const [{ data: events, error: eventsError }, { data: stops, error: stopsError }, { data: serviceRows, error: servicesError }] = await Promise.all([
      client.from('order_events').select('order_id,created_at,to_status').in('order_id', rows.map(row => row.id)).eq('to_status', 'delivered').order('created_at', { ascending: true }),
      client.from('route_stops').select('order_id,status,route_plans(status)').in('order_id', rows.map(row => row.id)),
      client.from('order_services').select('order_id,service_name,created_at').in('order_id', rows.map(row => row.id)).order('created_at', { ascending: true })
    ]);
    if (eventsError || stopsError || servicesError) return NextResponse.json({ error: eventsError?.message || stopsError?.message || servicesError?.message || 'Unable to load order details.' }, { status: 500 });
    (events ?? []).forEach(event => { if (!completionByOrder.has(event.order_id)) completionByOrder.set(event.order_id, event.created_at); });
    (serviceRows ?? []).forEach(service => servicesByOrder.set(service.order_id, [...(servicesByOrder.get(service.order_id) ?? []), service.service_name]));
    (stops ?? []).forEach(stop => {
      const current = routeByOrder.get(stop.order_id) ?? { active: false, draft: false, failed: false };
      const plan = Array.isArray(stop.route_plans) ? stop.route_plans[0] : stop.route_plans;
      const planStatus = plan?.status;
      current.active = current.active || (['approved', 'in_progress'].includes(planStatus ?? '') && ['planned', 'arrived'].includes(stop.status));
      current.draft = current.draft || (planStatus === 'draft' && ['planned', 'arrived'].includes(stop.status));
      current.failed = current.failed || stop.status === 'failed' || planStatus === 'failed';
      routeByOrder.set(stop.order_id, current);
    });
  }
  if (rows.length && profile.role !== 'customer') {
    const { data: exceptionRows, error: exceptionError } = await client.from('exceptions').select('order_id,description,severity,deadline_impact,customer_notified_at').in('order_id', rows.map(row => row.id)).neq('status', 'resolved').order('created_at', { ascending: false });
    if (exceptionError) return NextResponse.json({ error: exceptionError.message }, { status: 500 });
    (exceptionRows ?? []).forEach(exception => {
      const current = exceptionByOrder.get(exception.order_id);
      if (!current || (impactRank[exception.deadline_impact ?? 'none'] ?? 0) > (impactRank[current.deadline_impact ?? 'none'] ?? 0)) exceptionByOrder.set(exception.order_id, exception);
    });
  }
  const processorDetails = new Map<string, { name: string; address: string | null }>();
  if (profile?.role && profile.role !== 'customer') {
    const processorIds = [...new Set(rows.map(row => row.processor_id).filter((id): id is string => typeof id === 'string'))];
    if (processorIds.length) {
      const { data: processorRows } = await client.from('processors').select('id,name,address').in('id', processorIds);
      (processorRows ?? []).forEach(processor => processorDetails.set(processor.id, { name: processor.name, address: processor.address }));
    }
  }
  return NextResponse.json({ orders: rows.map(row => mapOrder(row, typeof row.processor_id === 'string' ? processorDetails.get(row.processor_id) : undefined, profile.role, exceptionByOrder.get(row.id) ?? null, completionByOrder.get(row.id), routeByOrder.get(row.id) ?? null, timezone, servicesByOrder.get(row.id))), timezone });
}

export async function POST(request: Request) {
  const parsed = orderInput.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid order payload', details: parsed.error.flatten() }, { status: 400 });
  const scheduleError = orderWindowError({ pickupStartAt: parsed.data.pickupWindowStartAt, pickupEndAt: parsed.data.pickupWindowEndAt, deliveryStartAt: parsed.data.deliveryWindowStartAt, deliveryEndAt: parsed.data.deliveryWindowEndAt }, { notBefore: new Date().toISOString(), toleranceMs: 5 * 60_000 });
  if (scheduleError) return NextResponse.json({ error: scheduleError }, { status: 400 });
  const deliveryEnd = new Date(parsed.data.deliveryWindowEndAt).getTime();
  if (Math.abs(deliveryEnd - new Date(parsed.data.dueAt).getTime()) > 1000) return NextResponse.json({ error: 'The committed deadline must match the delivery window end.' }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error:'Supabase is not configured' }, { status:503 });
  const { data: { user } } = await getUserSafely(supabase);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { data:profile } = await supabase.from('profiles').select('role,status').eq('id',user.id).single();
  if (!profile || profile.status !== 'active' || !['super_admin', 'dispatcher'].includes(profile.role)) return NextResponse.json({ error: 'Only dispatch staff can create orders.' }, { status: 403 });
  const { data: workspace } = await supabase.from('workspace_settings').select('services').eq('id', 'default').maybeSingle();
  if (!parsed.data.services.every(service => serviceIsConfigured(service, workspace?.services))) return NextResponse.json({ error: 'Choose services from the active workspace service catalog.' }, { status: 400 });
  const { data: account, error: accountError } = await supabase.from('customer_accounts').select('id,active').eq('id', parsed.data.customerAccountId).maybeSingle();
  if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });
  if (!account || !account.active) return NextResponse.json({ error: 'Choose an active CRM account.' }, { status: 400 });

  const { data: orderId, error: createError } = await supabase.rpc('create_dispatch_order', {
    p_order: {
      customer_account_id: account.id,
      customer_name: parsed.data.customer,
      phone: parsed.data.phone,
      pickup_address: parsed.data.pickupAddress,
      // Mapbox search responses are temporary by default. Route planning
      // geocodes the saved address when it needs coordinates, so do not
      // persist autocomplete coordinates with the customer record.
      pickup_latitude: null,
      pickup_longitude: null,
      delivery_address: parsed.data.deliveryAddress,
      delivery_latitude: null,
      delivery_longitude: null,
      expected_bags: parsed.data.bags,
      due_at_label: parsed.data.due,
      due_at: parsed.data.dueAt,
      pickup_window_start_at: parsed.data.pickupWindowStartAt,
      pickup_window_end_at: parsed.data.pickupWindowEndAt,
      delivery_window_start_at: parsed.data.deliveryWindowStartAt,
      delivery_window_end_at: parsed.data.deliveryWindowEndAt,
      notes: parsed.data.notes ?? null,
      item_description: parsed.data.items ?? null,
      textile_types: parsed.data.textileTypes ?? [],
      special_handling: parsed.data.specialHandling ?? [],
      customer_specifications: parsed.data.customerSpecifications ?? null,
      priority: parsed.data.priority ?? 'standard'
    },
    p_services: parsed.data.services
  });
  if (createError || !orderId) return NextResponse.json({ error: createError?.message ?? 'The order could not be created.' }, { status: 500 });
  const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logOperationalNotification({ orderId: data.id, event: 'order_created', message: `${data.order_number} was created and is ready for validation and processor matching. Deadline: ${new Date(data.due_at).toLocaleString()}.`, phone: data.phone }, supabase);
  return NextResponse.json({ order: data, persistence: 'supabase', validationRequired: true }, { status: 201 });
}
