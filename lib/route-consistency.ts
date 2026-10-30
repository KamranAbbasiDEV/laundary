import type { SupabaseClient } from '@supabase/supabase-js';

type RouteClient = SupabaseClient<any, any, any>;
type RouteStop = {
  id: string;
  route_id: string;
  order_id: string;
  sequence: number;
  route_plans: { status: string; route_type: string } | { status: string; route_type: string }[] | null;
};

const routeStatusForOrder = (routeType: string) => ({
  pickup: 'capacity_confirmed',
  processor_dropoff: 'picked_up',
  processor_pickup: 'ready_for_pickup',
  delivery: 'out_for_delivery'
} as Record<string, string>)[routeType];

const planRecord = (stop: RouteStop) => Array.isArray(stop.route_plans) ? stop.route_plans[0] : stop.route_plans;

export async function blockActiveRouteStatusChange(client: RouteClient, orderIds: string[], role: string) {
  if (!['super_admin', 'dispatcher'].includes(role)) return null;
  const { data, error } = await client
    .from('route_stops')
    .select('order_id,route_plans!inner(status,route_type)')
    .in('order_id', orderIds)
    .in('route_plans.status', ['approved', 'in_progress']);
  if (error) return { error: error.message, status: 500 as const };
  if ((data ?? []).length) return { error: 'One or more selected orders belong to an approved or active route. Complete the route or recover its failed stop before changing the order stage.', status: 409 as const };
  return null;
}

export async function syncDraftRoutesAfterStatusChange(client: RouteClient, orderStatuses: Map<string, string>) {
  if (!orderStatuses.size) return { invalidated: 0, warning: null as string | null };
  const orderIds = [...orderStatuses.keys()];
  const { data, error } = await client
    .from('route_stops')
    .select('id,route_id,order_id,sequence,route_plans!inner(status,route_type)')
    .in('order_id', orderIds)
    .eq('route_plans.status', 'draft');
  if (error) return { invalidated: 0, warning: `Order updated, but draft route synchronization failed: ${error.message}` };

  const affected = (data ?? []).filter((stop: RouteStop) => {
    const plan = planRecord(stop);
    return plan && routeStatusForOrder(plan.route_type) !== orderStatuses.get(stop.order_id);
  }) as RouteStop[];
  if (!affected.length) return { invalidated: 0, warning: null as string | null };

  const routeIds = [...new Set(affected.map(stop => stop.route_id))];
  const { error: deleteError } = await client.from('route_stops').delete().in('id', affected.map(stop => stop.id));
  if (deleteError) return { invalidated: 0, warning: `Order updated, but draft route synchronization failed: ${deleteError.message}` };

  for (const routeId of routeIds) {
    const { data: remaining, error: remainingError } = await client.from('route_stops').select('id').eq('route_id', routeId).order('sequence', { ascending: true });
    if (remainingError) return { invalidated: affected.length, warning: `Order updated, but draft route sequencing failed: ${remainingError.message}` };
    if (!(remaining ?? []).length) {
      const { error: deletePlanError } = await client.from('route_plans').delete().eq('id', routeId).eq('status', 'draft');
      if (deletePlanError) return { invalidated: affected.length, warning: `Order updated, but its empty draft route could not be removed: ${deletePlanError.message}` };
      continue;
    }
    for (const [index, stop] of (remaining ?? []).entries()) {
      const { error: temporaryError } = await client.from('route_stops').update({ sequence: -(index + 1) }).eq('id', stop.id);
      if (temporaryError) return { invalidated: affected.length, warning: `Order updated, but draft route sequencing failed: ${temporaryError.message}` };
    }
    for (const [index, stop] of (remaining ?? []).entries()) {
      const { error: sequenceError } = await client.from('route_stops').update({ sequence: index + 1 }).eq('id', stop.id);
      if (sequenceError) return { invalidated: affected.length, warning: `Order updated, but draft route sequencing failed: ${sequenceError.message}` };
    }
    const { error: invalidateError } = await client.from('route_plans').update({ mapbox_route: null }).eq('id', routeId).eq('status', 'draft');
    if (invalidateError) return { invalidated: affected.length, warning: `Order updated, but draft route invalidation failed: ${invalidateError.message}` };
  }
  return { invalidated: affected.length, warning: null as string | null };
}
