import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasRole, requireActiveUser } from '@/lib/api-auth';

const serviceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().default(''),
  price: z.string().trim().max(80).optional().default(''),
  turnaround: z.string().trim().max(80).optional().default('')
});

export async function POST(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher'])) return NextResponse.json({ error: 'Dispatch access required.' }, { status: 403 });
  const parsed = serviceSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Enter a valid service.' }, { status: 400 });
  const service = Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value));
  const { data, error } = await auth.client.rpc('add_workspace_service', { p_service: service });
  if (error) {
    const duplicate = /already exists/i.test(error.message);
    return NextResponse.json({ error: error.message }, { status: duplicate ? 409 : 400 });
  }
  return NextResponse.json({ service: data }, { status: 201 });
}
