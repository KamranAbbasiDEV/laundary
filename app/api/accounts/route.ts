import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hasRole, requireActiveUser } from '@/lib/api-auth';

const addressSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(80).default('Primary'),
  address: z.string().trim().min(5).max(500),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  isDefault: z.boolean().default(false)
});

const accountSchema = z.object({
  type: z.enum(['person', 'company']),
  displayName: z.string().trim().min(2).max(160),
  companyName: z.string().trim().max(160).optional(),
  contactName: z.string().trim().max(160).optional(),
  email: z.string().trim().email().max(250).or(z.literal('')).optional(),
  phone: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(4000).optional(),
  active: z.boolean().default(true),
  addresses: z.array(addressSchema).max(20).default([])
}).superRefine((value, context) => {
  if (value.type === 'company' && !value.companyName) context.addIssue({ code: 'custom', path: ['companyName'], message: 'Company name is required.' });
  if (!value.phone && !value.email) context.addIssue({ code: 'custom', path: ['phone'], message: 'Add a phone number or email address.' });
});

const updateSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['person', 'company']).optional(),
  displayName: z.string().trim().min(2).max(160).optional(),
  companyName: z.string().trim().max(160).optional(),
  contactName: z.string().trim().max(160).optional(),
  email: z.string().trim().email().max(250).or(z.literal('')).optional(),
  phone: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(4000).optional(),
  active: z.boolean().optional(),
  addresses: z.array(addressSchema).max(20).optional()
});

type AddressRow = { id: string; label: string; address: string; latitude?: number | null; longitude?: number | null; is_default: boolean };
type AccountRow = Record<string, unknown> & { customer_addresses?: AddressRow[] | null };

function mapAccount(row: AccountRow) {
  return {
    id: row.id,
    type: row.account_type,
    displayName: row.display_name,
    companyName: row.company_name ?? '',
    contactName: row.contact_name ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    notes: row.notes ?? '',
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    addresses: (row.customer_addresses ?? []).map(address => ({
      id: address.id,
      label: address.label,
      address: address.address,
      // Do not retain temporary Mapbox autocomplete coordinates in the CRM.
      latitude: null,
      longitude: null,
      isDefault: address.is_default
    })).sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.label.localeCompare(b.label))
  };
}

async function readAccount(client: SupabaseClient, id: string) {
  return client.from('customer_accounts').select('*, customer_addresses(*)').eq('id', id).maybeSingle();
}

export async function GET(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher'])) return NextResponse.json({ error: 'Dispatcher access required.' }, { status: 403 });
  const url = new URL(request.url);
  const queryText = url.searchParams.get('q')?.trim().slice(0, 80).replace(/[\\%(),]/g, ' ').replace(/\s+/g, ' ');
  const type = url.searchParams.get('type');
  let query = auth.client.from('customer_accounts').select('*, customer_addresses(*)').order('display_name').limit(250);
  if (type === 'person' || type === 'company') query = query.eq('account_type', type);
  if (queryText) query = query.or(`display_name.ilike.%${queryText}%,company_name.ilike.%${queryText}%,contact_name.ilike.%${queryText}%,email.ilike.%${queryText}%,phone.ilike.%${queryText}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ accounts: (data ?? []).map(row => mapAccount(row as AccountRow)) });
}

export async function POST(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher'])) return NextResponse.json({ error: 'Dispatcher access required.' }, { status: 403 });
  const parsed = accountSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid account details.', details: parsed.error.flatten() }, { status: 400 });
  const value = parsed.data;
  const { data: account, error } = await auth.client.from('customer_accounts').insert({
    account_type: value.type,
    display_name: value.displayName,
    company_name: value.type === 'company' ? value.companyName : null,
    contact_name: value.contactName || (value.type === 'person' ? value.displayName : null),
    email: value.email || null,
    phone: value.phone || null,
    notes: value.notes || null,
    active: value.active,
    created_by: auth.user.id,
    updated_by: auth.user.id
  }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (value.addresses.length) {
    const hasDefault = value.addresses.some(address => address.isDefault);
    const { error: addressError } = await auth.client.from('customer_addresses').insert(value.addresses.map((address, index) => ({
      account_id: account.id,
      label: address.label,
      address: address.address,
      latitude: address.latitude ?? null,
      longitude: address.longitude ?? null,
      is_default: hasDefault ? address.isDefault : index === 0
    })));
    if (addressError) {
      await auth.client.from('customer_accounts').delete().eq('id', account.id);
      return NextResponse.json({ error: addressError.message }, { status: 500 });
    }
  }
  const { data, error: readError } = await readAccount(auth.client, account.id);
  if (readError || !data) return NextResponse.json({ error: readError?.message ?? 'Account could not be reloaded.' }, { status: 500 });
  return NextResponse.json({ account: mapAccount(data as AccountRow) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher'])) return NextResponse.json({ error: 'Dispatcher access required.' }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid account update.', details: parsed.error.flatten() }, { status: 400 });
  const { id, addresses, ...value } = parsed.data;
  const update = {
    ...(value.type !== undefined ? { account_type: value.type } : {}),
    ...(value.displayName !== undefined ? { display_name: value.displayName } : {}),
    ...(value.companyName !== undefined ? { company_name: value.companyName || null } : {}),
    ...(value.contactName !== undefined ? { contact_name: value.contactName || null } : {}),
    ...(value.email !== undefined ? { email: value.email || null } : {}),
    ...(value.phone !== undefined ? { phone: value.phone || null } : {}),
    ...(value.notes !== undefined ? { notes: value.notes || null } : {}),
    ...(value.active !== undefined ? { active: value.active } : {}),
    updated_by: auth.user.id,
    updated_at: new Date().toISOString()
  };
  const { data: account, error } = await auth.client.from('customer_accounts').update(update).eq('id', id).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!account) return NextResponse.json({ error: 'Customer account not found.' }, { status: 404 });
  if (addresses) {
    const { data: existing, error: existingError } = await auth.client.from('customer_addresses').select('id').eq('account_id', id);
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
    const incomingIds = new Set(addresses.flatMap(address => address.id ? [address.id] : []));
    const removeIds = (existing ?? []).map(address => address.id).filter(addressId => !incomingIds.has(addressId));
    if (removeIds.length) {
      const { error: deleteError } = await auth.client.from('customer_addresses').delete().in('id', removeIds).eq('account_id', id);
      if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
    const hasDefault = addresses.some(address => address.isDefault);
    for (const [index, address] of addresses.entries()) {
      const row = { account_id: id, label: address.label, address: address.address, latitude: null, longitude: null, is_default: hasDefault ? address.isDefault : index === 0, updated_at: new Date().toISOString() };
      const result = address.id
        ? await auth.client.from('customer_addresses').update(row).eq('id', address.id).eq('account_id', id)
        : await auth.client.from('customer_addresses').insert(row);
      if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    }
  }
  const { data, error: readError } = await readAccount(auth.client, id);
  if (readError || !data) return NextResponse.json({ error: readError?.message ?? 'Account could not be reloaded.' }, { status: 500 });
  return NextResponse.json({ account: mapAccount(data as AccountRow) });
}
