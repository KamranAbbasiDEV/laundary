import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasRole, requireActiveUser } from '@/lib/api-auth';

const settingsSchema = z.object({
  company_name: z.string().min(2).max(120), timezone: z.string().min(1).max(80), operating_days: z.array(z.string()).max(7),
  holidays: z.array(z.string()).max(100), pickup_windows: z.array(z.record(z.string(), z.unknown())).max(50), services: z.array(z.record(z.string(), z.unknown())).max(100),
  turnaround_rules: z.record(z.string(), z.unknown()), notification_templates: z.record(z.string(), z.unknown()), matching_rules: z.record(z.string(), z.number().nonnegative()),
  payment_methods: z.array(z.string()).max(20), photo_retention_days: z.number().int().positive().max(3650), support_email: z.string().email().nullable().optional()
});

export async function GET() {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await auth.client.from('workspace_settings').select('*').eq('id', 'default').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}

export async function PATCH(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin'])) return NextResponse.json({ error: 'Super Admin access required.' }, { status: 403 });
  const parsed = settingsSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid workspace settings.', details: parsed.error.flatten() }, { status: 400 });
  const { data, error } = await auth.client.from('workspace_settings').upsert({ id: 'default', ...parsed.data, updated_by: auth.user.id, updated_at: new Date().toISOString() }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
