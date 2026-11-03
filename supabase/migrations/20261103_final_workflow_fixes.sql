-- Final compatibility and staff-intake fixes.

-- Older orders did not store a separate delivery address. Their operational
-- behavior was "same as pickup", so preserve that intent explicitly.
update public.orders
set customer_delivery_address = pickup_address,
    updated_at = now()
where nullif(trim(customer_delivery_address), '') is null
  and nullif(trim(pickup_address), '') is not null;

-- Dispatch staff may add one catalog item during intake without receiving
-- broad write access to workspace settings.
create or replace function public.add_workspace_service(p_service jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  service_name text := trim(coalesce(p_service->>'name', ''));
  normalized_service jsonb;
  current_services jsonb;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active' and role in ('super_admin', 'dispatcher')
  ) then
    raise exception 'Dispatch access required';
  end if;
  if length(service_name) < 2 or length(service_name) > 120 then
    raise exception 'Service name must be between 2 and 120 characters';
  end if;

  insert into public.workspace_settings (id) values ('default') on conflict (id) do nothing;
  select coalesce(services, '[]'::jsonb) into current_services
  from public.workspace_settings where id = 'default' for update;

  if exists (
    select 1 from jsonb_array_elements(current_services) item
    where lower(trim(coalesce(item->>'name', item #>> '{}'))) = lower(service_name)
  ) then
    raise exception 'A service named "%" already exists', service_name;
  end if;

  normalized_service := jsonb_strip_nulls(jsonb_build_object(
    'name', service_name,
    'description', nullif(trim(coalesce(p_service->>'description', '')), ''),
    'price', nullif(trim(coalesce(p_service->>'price', '')), ''),
    'turnaround', nullif(trim(coalesce(p_service->>'turnaround', '')), '')
  ));
  update public.workspace_settings
  set services = current_services || jsonb_build_array(normalized_service),
      updated_by = auth.uid(), updated_at = now()
  where id = 'default';
  return normalized_service;
end;
$$;

revoke all on function public.add_workspace_service(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.add_workspace_service(jsonb) to authenticated;
