import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { canTransition } from '@/lib/workflow';
import type { OrderStatus } from '@/lib/types';

const bodySchema = z.object({ status: z.string().optional(), exception: z.string().optional(), note: z.string().optional() });
const displayStatus = (value: string): OrderStatus => ({
  created:'Created',validated:'Validated',processor_ranked:'Processor ranked',capacity_confirmed:'Capacity confirmed',pickup_scheduled:'Pickup scheduled',picked_up:'Picked up',at_processor:'At processor',processing:'Processing',ready_for_pickup:'Ready for pickup',picked_up_from_processor:'Picked up from processor',qc_reconciliation:'QC / Reconciliation',out_for_delivery:'Out for delivery',delivered:'Delivered',processor_reviewed:'Processor reviewed'
} as Record<string, OrderStatus>)[value] ?? value as OrderStatus;
const dbStatus = (value: string) => ({
  'Created':'created','Validated':'validated','Processor ranked':'processor_ranked','Capacity confirmed':'capacity_confirmed','Pickup scheduled':'pickup_scheduled','Picked up':'picked_up','At processor':'at_processor','Processing':'processing','Ready for pickup':'ready_for_pickup','Picked up from processor':'picked_up_from_processor','QC / Reconciliation':'qc_reconciliation','Out for delivery':'out_for_delivery','Delivered':'delivered','Processor reviewed':'processor_reviewed'
} as Record<string, string>)[value] ?? value.toLowerCase().replaceAll(' ', '_');

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = bodySchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: 'Invalid update payload' }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error:'Supabase is not configured' }, { status:503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const { data: current, error: readError } = await supabase.from('orders').select('id,status').or(`id.eq.${id},order_number.eq.${id}`).maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  const currentDisplay = displayStatus(current.status);
  if (body.data.status && !canTransition(currentDisplay, body.data.status as OrderStatus)) return NextResponse.json({ error: `Invalid transition from ${currentDisplay} to ${body.data.status}` }, { status: 409 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.data.status) update.status = dbStatus(body.data.status);
  if (body.data.exception) update.has_exception = true;
  const { data, error } = await supabase.from('orders').update(update).eq('id', current.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from('order_events').insert({ order_id: current.id, from_status: current.status, to_status: body.data.status ? dbStatus(body.data.status) : current.status, note: body.data.note ?? body.data.exception ?? null });
  return NextResponse.json({ order: data, persistence: 'supabase' });
}
