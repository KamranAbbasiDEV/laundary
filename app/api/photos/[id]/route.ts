import { NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/api-auth';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const { data: photo, error } = await auth.client.from('order_photos').select('id,order_id,storage_path,mime_type').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!photo) return NextResponse.json({ error: 'Photo not found.' }, { status: 404 });
  if (auth.profile.role === 'driver') {
    const { data: order } = await auth.client.from('orders').select('assigned_driver_id').eq('id', photo.order_id).maybeSingle();
    if (order?.assigned_driver_id !== auth.user.id) return NextResponse.json({ error: 'Photo access denied.' }, { status: 403 });
  }
  if (auth.profile.role === 'processor') {
    const { data: order } = await auth.client.from('orders').select('processor_id').eq('id', photo.order_id).maybeSingle();
    if (order?.processor_id !== auth.profile.processor_id) return NextResponse.json({ error: 'Photo access denied.' }, { status: 403 });
  }
  const { data: file, error: downloadError } = await auth.client.storage.from('order-photos').download(photo.storage_path);
  if (downloadError || !file) return NextResponse.json({ error: downloadError?.message || 'Photo unavailable.' }, { status: 404 });
  return new NextResponse(file, { headers: { 'Content-Type': photo.mime_type || file.type || 'application/octet-stream', 'Cache-Control': 'private, max-age=3600' } });
}
