-- Preserve every deadline revision instead of retaining only the latest reason.
create table if not exists public.deadline_revisions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  previous_original_due_at timestamptz,
  original_due_at timestamptz,
  previous_committed_due_at timestamptz,
  committed_due_at timestamptz,
  reason text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists deadline_revisions_order_idx
  on public.deadline_revisions (order_id, changed_at desc);

alter table public.deadline_revisions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'deadline_revisions' and policyname = 'operations read deadline revisions') then
    create policy "operations read deadline revisions" on public.deadline_revisions
      for select to authenticated using (public.is_operations_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'deadline_revisions' and policyname = 'operations create deadline revisions') then
    create policy "operations create deadline revisions" on public.deadline_revisions
      for insert to authenticated with check (public.is_operations_user());
  end if;
end $$;
