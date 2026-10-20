-- Exception deadline management: preserve the original commitment, record revisions,
-- and keep customer-safe communication separate from internal resolution notes.
alter table public.orders add column if not exists original_due_at timestamptz;
alter table public.orders add column if not exists deadline_revised_at timestamptz;
alter table public.orders add column if not exists deadline_revised_by uuid references auth.users(id) on delete set null;
alter table public.orders add column if not exists deadline_revision_reason text;
alter table public.orders add column if not exists customer_exception_message text;
alter table public.orders add column if not exists customer_exception_notified_at timestamptz;
update public.orders set original_due_at = due_at where original_due_at is null and due_at is not null;

alter table public.exceptions add column if not exists deadline_impact text not null default 'none';
alter table public.exceptions add column if not exists deadline_before timestamptz;
alter table public.exceptions add column if not exists deadline_after timestamptz;
alter table public.exceptions add column if not exists deadline_reason text;
alter table public.exceptions add column if not exists customer_message text;
alter table public.exceptions add column if not exists customer_notified_at timestamptz;
alter table public.exceptions add column if not exists customer_notified_by uuid references auth.users(id) on delete set null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'exceptions_deadline_impact_check' and conrelid = 'public.exceptions'::regclass) then
    alter table public.exceptions add constraint exceptions_deadline_impact_check check (deadline_impact in ('none','at_risk','delayed')) not valid;
    alter table public.exceptions validate constraint exceptions_deadline_impact_check;
  end if;
end $$;
create index if not exists exceptions_deadline_impact_idx on public.exceptions (deadline_impact, created_at desc) where deadline_impact <> 'none';
