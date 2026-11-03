import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { orderWindowError } from '@/lib/order-scheduling';
import { serviceIsConfigured } from '@/lib/service-catalog';
import { logOperationalNotification } from '@/lib/notifications';

const payloadSchema = z.object({
  externalId: z.string().min(1).max(160),
  customer: z.string().min(2),
  phone: z.string().min(7),
  email: z.string().email().optional(),
  accountType: z.enum(['person', 'company']).default('person'),
  companyName: z.string().min(2).max(160).optional(),
  customerAccountId: z.string().uuid().optional(),
  address: z.string().min(5),
  deliveryAddress: z.string().min(5),
  service: z.string().min(1).optional(),
  services: z.array(z.string().min(1)).min(1).max(12).optional(),
  bags: z.number().int().positive(),
  due: z.string().min(1),
  dueAt: z.string().datetime({ offset: true }),
  pickupWindowStartAt: z.string().datetime({ offset: true }),
  pickupWindowEndAt: z.string().datetime({ offset: true }),
  deliveryWindowStartAt: z.string().datetime({ offset: true }),
  deliveryWindowEndAt: z.string().datetime({ offset: true }),
  notes: z.string().max(4000).optional(),
  source: z.string().min(2).max(60).default('crm')
}).superRefine((value, context) => {
  const selected = value.services?.map(service => service.trim()).filter(Boolean) ?? (value.service ? [value.service.trim()] : []);
  if (!selected.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['services'], message: 'At least one service is required.' });
  if (new Set(selected.map(service => service.toLowerCase())).size !== selected.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['services'], message: 'Services must be unique.' });
  if (value.accountType === 'company' && !value.companyName) context.addIssue({ code: z.ZodIssueCode.custom, path: ['companyName'], message: 'Company name is required for a company account.' });
  if (new Date(value.deliveryWindowEndAt).getTime() <= new Date(value.deliveryWindowStartAt).getTime()) context.addIssue({ code: z.ZodIssueCode.custom, path: ['deliveryWindowEndAt'], message: 'Delivery window end must be after its start.' });
  if (new Date(value.deliveryWindowStartAt).getTime() <= new Date(value.pickupWindowEndAt).getTime()) context.addIssue({ code: z.ZodIssueCode.custom, path: ['deliveryWindowStartAt'], message: 'Delivery window must begin after pickup.' });
  if (Math.abs(new Date(value.deliveryWindowEndAt).getTime() - new Date(value.dueAt).getTime()) > 1000) context.addIssue({ code: z.ZodIssueCode.custom, path: ['dueAt'], message: 'The committed deadline must match the delivery window end.' });
});

export async function POST(request: Request) {
  const key = process.env.ORDER_INTAKE_API_KEY;
  if (!key) return NextResponse.json({ error: 'External order intake is not configured.' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${key}`) return NextResponse.json({ error: 'Unauthorized integration request.' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Supabase service access is not configured.' }, { status: 503 });
  const parsed = payloadSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid order payload.', details: parsed.error.flatten() }, { status: 400 });
  const item = parsed.data;
  const selectedServices = item.services?.map(service => service.trim()).filter(Boolean) ?? [item.service!.trim()];
  const scheduleError = orderWindowError({ pickupStartAt: item.pickupWindowStartAt, pickupEndAt: item.pickupWindowEndAt, deliveryStartAt: item.deliveryWindowStartAt, deliveryEndAt: item.deliveryWindowEndAt }, { notBefore: new Date().toISOString(), toleranceMs: 5 * 60_000 });
  if (scheduleError) return NextResponse.json({ error: scheduleError }, { status: 400 });
  const { data: workspace, error: workspaceError } = await supabaseAdmin.from('workspace_settings').select('services').eq('id', 'default').maybeSingle();
  if (workspaceError) return NextResponse.json({ error: workspaceError.message }, { status: 500 });
  if (!selectedServices.every(service => serviceIsConfigured(service, workspace?.services))) return NextResponse.json({ error: 'Choose services from the active workspace service catalog.' }, { status: 400 });

  const { data: existing, error: lookupError } = await supabaseAdmin.from('orders').select('id,order_number,status,validation_state').eq('intake_source', item.source).eq('external_id', item.externalId).maybeSingle();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (existing) return NextResponse.json({ order: existing, idempotent: true, validationRequired: existing.status === 'created' || existing.validation_state === 'manual_review' });

  let accountId = item.customerAccountId;
  if (accountId) {
    const { data: account, error: accountError } = await supabaseAdmin.from('customer_accounts').select('id').eq('id', accountId).eq('active', true).maybeSingle();
    if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });
    if (!account) return NextResponse.json({ error: 'The supplied CRM account is not active.' }, { status: 400 });
  } else {
    const { data: matchingAccounts, error: accountLookupError } = await supabaseAdmin.from('customer_accounts').select('id').eq('phone', item.phone).eq('active', true).order('created_at').limit(1);
    if (accountLookupError) return NextResponse.json({ error: accountLookupError.message }, { status: 500 });
    accountId = matchingAccounts?.[0]?.id;
    if (!accountId) {
      const { data: createdAccount, error: createAccountError } = await supabaseAdmin.from('customer_accounts').insert({ account_type: item.accountType, display_name: item.accountType === 'company' ? item.companyName : item.customer, company_name: item.accountType === 'company' ? item.companyName : null, contact_name: item.customer, email: item.email ?? null, phone: item.phone, active: true }).select('id').single();
      if (createAccountError) return NextResponse.json({ error: `The CRM account could not be created: ${createAccountError.message}` }, { status: 500 });
      accountId = createdAccount.id;
    }
  }
  const { data: savedAddresses, error: addressLookupError } = await supabaseAdmin.from('customer_addresses').select('id,address').eq('account_id', accountId);
  if (addressLookupError) return NextResponse.json({ error: addressLookupError.message }, { status: 500 });
  const addressesToSave = [...new Set([item.address, item.deliveryAddress])].filter(address => !(savedAddresses ?? []).some(saved => saved.address.trim().toLowerCase() === address.trim().toLowerCase()));
  if (addressesToSave.length) {
    const { error: saveAddressError } = await supabaseAdmin.from('customer_addresses').insert(addressesToSave.map((address, index) => ({ account_id: accountId, label: address === item.address ? 'Pickup' : 'Delivery', address, is_default: !(savedAddresses ?? []).length && index === 0 })));
    if (saveAddressError) return NextResponse.json({ error: `The CRM address could not be saved: ${saveAddressError.message}` }, { status: 500 });
  }

  const { data: order, error: insertError } = await supabaseAdmin.from('orders').insert({
    customer_account_id: accountId,
    customer_name: item.customer,
    phone: item.phone,
    pickup_address: item.address,
    customer_delivery_address: item.deliveryAddress,
    service_type: selectedServices.join(', '),
    expected_bags: item.bags,
    due_at_label: item.due,
    due_at: item.dueAt,
    original_due_at: item.dueAt,
    pickup_window_start_at: item.pickupWindowStartAt,
    pickup_window_end_at: item.pickupWindowEndAt,
    delivery_window_start_at: item.deliveryWindowStartAt,
    delivery_window_end_at: item.deliveryWindowEndAt,
    notes: item.notes ?? null,
    status: 'created',
    validation_state: 'manual_review',
    validated_at: null,
    validated_by: null,
    customer_user_id: null,
    intake_source: item.source,
    external_id: item.externalId
  }).select('id,order_number,status,validation_state,phone,due_at').single();

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: concurrentOrder, error: concurrentError } = await supabaseAdmin.from('orders').select('id,order_number,status,validation_state').eq('intake_source', item.source).eq('external_id', item.externalId).maybeSingle();
      if (!concurrentError && concurrentOrder) return NextResponse.json({ order: concurrentOrder, idempotent: true, validationRequired: concurrentOrder.status === 'created' || concurrentOrder.validation_state === 'manual_review' });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await logOperationalNotification({ orderId: order.id, event: 'order_created', message: `${order.order_number} was received from ${item.source} and is ready for dispatcher validation.`, phone: order.phone }, supabaseAdmin);
  return NextResponse.json({ order, idempotent: false, validationRequired: true }, { status: 201 });
}
