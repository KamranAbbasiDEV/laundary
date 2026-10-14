import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const authClient = await createSupabaseServerClient();
  if (!authClient) return NextResponse.json({ error: 'The workspace is not configured.' }, { status: 503 });
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { data: profile } = await authClient.from('profiles').select('role,status').eq('id', user.id).single();
  if (!profile || profile.status !== 'active' || !['super_admin', 'dispatcher', 'driver', 'processor'].includes(profile.role)) return NextResponse.json({ error: 'Operations access required' }, { status: 403 });
  const form = await request.formData();
  const file = form.get('file');
  const orderId = String(form.get('orderId') ?? '');
  const kind = String(form.get('kind') ?? 'handoff');
  if (!(file instanceof File) || !orderId) return NextResponse.json({ error: 'file and orderId are required' }, { status: 400 });
  if (!file.type.startsWith('image/') || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Only images up to 10 MB are supported' }, { status: 400 });
  if (!/^[a-z0-9 _-]{2,40}$/i.test(kind)) return NextResponse.json({ error: 'Invalid photo type' }, { status: 400 });
  if (!supabaseAdmin) return NextResponse.json({ error:'Supabase Storage is not configured' }, { status:503 });
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId);
  const lookup = isUuid
    ? await supabaseAdmin.from('orders').select('id').eq('id', orderId).maybeSingle()
    : await supabaseAdmin.from('orders').select('id').eq('order_number', orderId).maybeSingle();
  if (lookup.error) return NextResponse.json({ error: lookup.error.message }, { status: 500 });
  if (!lookup.data?.id) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  const dbOrderId = lookup.data.id;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${dbOrderId}/${kind}/${Date.now()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const upload = await supabaseAdmin.storage.from('order-photos').upload(path, bytes, { contentType: file.type, upsert: false });
  if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 500 });
  const { data, error } = await supabaseAdmin.from('order_photos').insert({ order_id: dbOrderId, storage_path: path, kind, mime_type: file.type, size_bytes: file.size }).select().single();
  if (error) {
    await supabaseAdmin.storage.from('order-photos').remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ uploaded: true, photo: data, persistence: 'supabase' }, { status: 201 });
}
