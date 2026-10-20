-- Enable the operational tables used by the client realtime workspace refresh.
do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['orders','order_events','exceptions','order_handoffs','order_photos','processors','processor_offers','route_plans','route_stops','payments','notification_log'] loop
      if to_regclass(format('public.%I', table_name)) is not null and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end $$;
