# Production deployment

RinseLine is configured as a Next.js server application backed by Supabase. It does not seed demo records or provide a local authentication fallback. Configure the production services before exposing the application.

## Required setup

1. Create the Supabase project and run [supabase/schema.sql](./supabase/schema.sql).
2. Run the additive workflow migration at [supabase/migrations/20261014_core_workflow_upgrade.sql](./supabase/migrations/20261014_core_workflow_upgrade.sql).
3. Create the first owner account through the signup page, then promote that account once in the SQL editor:

```sql
update public.profiles
set role = 'super_admin', status = 'active', onboarding_complete = true
where id = (select id from auth.users where email = 'owner@example.com');
```

If the Supabase project was initialized before the current schema, run this once as well. It adds the processor relationship required by the order workflow without changing existing orders:

```sql
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_processor_id_fkey'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_processor_id_fkey
      foreign key (processor_id)
      references public.processors(id)
      on delete set null;
  end if;
end $$;
```

The order API also loads processor names separately, so existing deployments will continue working after the application is redeployed even while Supabase refreshes its schema cache.

The public signup page creates Customer accounts only. The Super Admin invites Dispatchers, Drivers, and approved Processor users from Team and invitations. Processors may also apply at `/apply/processor`; approval creates their processor record before access is invited.
4. Configure Supabase Auth email confirmation and redirect URLs for the deployed domain, including `/invite`.
5. Add the variables in [.env.example](./.env.example) to the hosting provider.
6. Create the `order-photos` Storage bucket and verify its policies.
7. Configure Twilio, Mapbox, and Inngest credentials before enabling those workflows.
8. Deploy through Vercel or another Node-compatible Next.js host.

## Vercel

1. Import the repository into Vercel.
2. Keep the detected framework as **Next.js**.
3. Add all production variables from [.env.example](./.env.example).
4. Deploy and configure Supabase Auth redirect URLs using the deployed domain.

The repository’s [vercel.json](./vercel.json) only sets the build command. Vercel manages the Next.js output automatically.

## Local production verification

```bash
npm run build
npm run start
```

Open `http://localhost:3000/login`. Without the production variables, the application will intentionally show a configuration error rather than accept fake credentials or display seeded records.
