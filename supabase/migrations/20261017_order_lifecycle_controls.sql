alter table public.orders add column if not exists archived_at timestamptz;
alter table public.orders add column if not exists archived_by uuid references auth.users(id) on delete set null;
create index if not exists orders_archived_at_idx on public.orders (archived_at) where archived_at is not null;

-- Permanent removal is deliberately limited to Super Admin. Archive remains the normal reversible path.
drop policy if exists "super admins delete orders" on public.orders;
create policy "super admins delete orders" on public.orders for delete to authenticated using (public.is_super_admin());

drop policy if exists "super admins write audit log" on public.audit_log;
create policy "super admins write audit log" on public.audit_log for insert to authenticated with check (public.is_super_admin());
