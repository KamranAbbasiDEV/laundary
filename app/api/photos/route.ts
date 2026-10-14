import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const authClient = await createSupabaseServerClient();
  if (authClient) { const { data: { user } } = await authClient.auth.getUser(); if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 }); }
  const form = await request.formData();
  const file = form.get('file');
  const orderId = String(form.get('orderId') ?? '');
  const kind = String(form.get('kind') ?? 'handoff');
  if (!(file instanceof File) || !orderId) return NextResponse.json({ error: 'file and orderId are required' }, { status: 400 });
  if (!file.type.startsWith('image/') || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Only images up to 10 MB are supported' }, { status: 400 });
  if (!supabaseAdmin) return NextResponse.json({ uploaded: false, persistence: 'local-fallback', fileName: file.name });
  const lookup = await supabaseAdmin.from('orders').select('id').or(`id.eq.${orderId},order_number.eq.${orderId}`).maybeSingle();
  const dbOrderId = lookup.data?.id ?? orderId;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${dbOrderId}/${kind}/${Date.now()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const upload = await supabaseAdmin.storage.from('order-photos').upload(path, bytes, { contentType: file.type, upsert: false });
  if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 500 });
  const { data, error } = await supabaseAdmin.from('order_photos').insert({ order_id: dbOrderId, storage_path: path, kind, mime_type: file.type, size_bytes: file.size }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ uploaded: true, photo: data, persistence: 'supabase' }, { status: 201 });
}
