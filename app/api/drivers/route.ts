import { NextResponse } from 'next/server';
import { hasRole, requireActiveUser } from '@/lib/api-auth';

export async function GET() {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher'])) return NextResponse.json({ error: 'Dispatcher access required.' }, { status: 403 });
  const { data, error } = await auth.client.from('profiles').select('id,full_name,phone').eq('role', 'driver').eq('status', 'active').order('full_name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drivers: (data ?? []).map(driver => ({ id: driver.id, name: driver.full_name || driver.phone || 'Unnamed driver' })) });
}
