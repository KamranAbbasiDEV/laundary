-- Final workflow completion: processor drop-off routes.
-- Existing route rows remain valid; only the allowed route type set expands.
alter table public.route_plans drop constraint if exists route_plans_route_type_check;
alter table public.route_plans add constraint route_plans_route_type_check check (route_type in ('pickup','processor_dropoff','processor_pickup','delivery'));
alter table public.route_stops drop constraint if exists route_stops_route_type_check;
alter table public.route_stops add constraint route_stops_route_type_check check (route_type in ('pickup','processor_dropoff','processor_pickup','delivery'));
