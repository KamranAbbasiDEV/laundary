import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getUserSafely } from '@/lib/supabase-auth';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const authClient = await createSupabaseServerClient();
  if (!authClient) return NextResponse.json({ error: 'The workspace is not configured.' }, { status: 503 });
  const { data: { user } } = await getUserSafely(authClient);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { data: profile } = await authClient.from('profiles').select('role,status,processor_id').eq('id', user.id).single();
  if (!profile || profile.status !== 'active' || !['super_admin', 'dispatcher', 'driver', 'processor'].includes(profile.role)) return NextResponse.json({ error: 'Operations access required' }, { status: 403 });
  const form = await request.formData();
  const file = form.get('file');
  const orderId = String(form.get('orderId') ?? '');
  const kind = String(form.get('kind') ?? 'handoff');
  if (!(file instanceof File) || !orderId) return NextResponse.json({ error: 'file and orderId are required' }, { status: 400 });
  if (!file.type.startsWith('image/') || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Only images up to 10 MB are supported' }, { status: 400 });
  if (!/^[a-z0-9 _-]{2,40}$/i.test(kind)) return NextResponse.json({ error: 'Invalid photo type' }, { status: 400 });
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId);
  const lookup = isUuid
    ? await authClient.from('orders').select('id,assigned_driver_id,processor_id').eq('id', orderId).maybeSingle()
    : await authClient.from('orders').select('id,assigned_driver_id,processor_id').eq('order_number', orderId).maybeSingle();
  if (lookup.error) return NextResponse.json({ error: lookup.error.message }, { status: 500 });
  if (!lookup.data?.id) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  const dbOrderId = lookup.data.id;
  if (profile.role === 'driver' && lookup.data.assigned_driver_id !== user.id) return NextResponse.json({ error: 'You can only upload photos for orders assigned to you.' }, { status: 403 });
  if (profile.role === 'processor' && lookup.data.processor_id !== profile.processor_id) return NextResponse.json({ error: 'You can only upload photos for orders assigned to your processor.' }, { status: 403 });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${dbOrderId}/${kind}/${Date.now()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const upload = await authClient.storage.from('order-photos').upload(path, bytes, { contentType: file.type, upsert: false });
  if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 500 });
  const { data, error } = await authClient.from('order_photos').insert({ order_id: dbOrderId, storage_path: path, kind, mime_type: file.type, size_bytes: file.size }).select().single();
  if (error) {
    await authClient.storage.from('order-photos').remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ uploaded: true, photo: data, persistence: 'supabase' }, { status: 201 });
}
