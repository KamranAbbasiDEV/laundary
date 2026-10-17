'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Map, Route, Square, CheckSquare } from 'lucide-react';
import { Button } from './ui/button';
import RouteMap from './route-map';
import type { Order } from '@/lib/types';

type RouteType = 'pickup' | 'processor_pickup' | 'delivery';
type RoutePreview = { id: string; durationSeconds?: number | null; distanceMeters?: number | null; coordinates?: [number, number][]; stopCoordinates?: [number, number][] };

export default function RoutePlannerPanel({ orders, notify, onApproveRoute }: { orders: Order[]; notify: (message: string) => void; onApproveRoute: (orderIds?: string[]) => void }) {
  const [routeType, setRouteType] = useState<RouteType>('pickup');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<RoutePreview | null>(null);
  const [driverId, setDriverId] = useState('');
  const [drivers, setDrivers] = useState<Array<{ id: string; name: string }>>([]);
  const stops = useMemo(() => orders.filter(order => routeType === 'pickup' ? order.status === 'Capacity confirmed' : routeType === 'processor_pickup' ? order.status === 'Ready for pickup' : order.status === 'Picked up from processor'), [orders, routeType]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  useEffect(() => { void fetch('/api/drivers').then(response => response.ok ? response.json() : { drivers: [] }).then(body => setDrivers(body.drivers ?? [])); }, []);
  useEffect(() => { setSelectedOrderIds(stops.map(order => order.internalId).filter((value): value is string => Boolean(value))); setPlan(null); }, [routeType, orders]);

  const selectedStops = stops.filter(order => order.internalId && selectedOrderIds.includes(order.internalId));
  const toggle = (id?: string) => { if (!id) return; setSelectedOrderIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]); setPlan(null); };
  async function generate() {
    const orderIds = selectedStops.map(order => order.internalId).filter((value): value is string => Boolean(value));
    if (!orderIds.length) return notify('Select at least one eligible order to add to this route');
    if (!driverId) return notify('Select a driver before generating the route');
    setBusy(true);
    const response = await fetch('/api/route-plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ routeDate: date, routeType, orderIds, driverId }) });
    const body = await response.json(); setBusy(false);
    if (!response.ok) return notify(body.error || 'Mapbox route generation failed');
    setPlan({ id: body.plan.id, ...body.route, stopCoordinates: (body.geocoded ?? []).flatMap((item: { coordinates?: [number, number] | null }) => item.coordinates ? [item.coordinates] : []) });
    notify('Mapbox route generated and saved for dispatcher review');
  }
  async function approve() {
    if (!plan) return; setBusy(true);
    const response = await fetch('/api/route-plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: plan.id }) });
    const body = await response.json(); setBusy(false);
    if (!response.ok) return notify(body.error || 'Unable to approve this route');
    if (routeType === 'pickup') onApproveRoute(selectedStops.map(order => order.id));
    else notify('Route approved and assigned to the selected driver');
  }
  const distance = plan?.distanceMeters == null ? 'Distance unavailable' : `${Math.round(plan.distanceMeters / 1000)} km`;
  const duration = plan?.durationSeconds == null ? 'Duration unavailable' : `${Math.round(plan.durationSeconds / 60)} min`;

  return <>
    <div className="page-heading"><div><div className="eyebrow">Mapbox route operations</div><h1>Route planner</h1><p>Select eligible orders, inspect the generated route, then approve driver assignment.</p></div><Button onClick={() => void approve()} disabled={!plan || busy}><Check size={14}/>{busy ? 'Approving…' : 'Approve route'}</Button></div>
    <section className="panel" style={{ marginBottom: 18 }}><div className="panel-heading"><div><h2>Generate route</h2><p>Draft routes do not assign work until dispatcher approval.</p></div><Map size={17} color="var(--teal)"/></div><div className="panel-body form-grid"><div className="form-field"><label>Route date</label><input className="form-control" type="date" value={date} onChange={event => { setDate(event.target.value); setPlan(null); }}/></div><div className="form-field"><label>Route type</label><select className="form-control" value={routeType} onChange={event => setRouteType(event.target.value as RouteType)}><option value="pickup">Customer pickup</option><option value="processor_pickup">Processor pickup</option><option value="delivery">Customer delivery</option></select></div><div className="form-field"><label>Assigned driver</label><select className="form-control" value={driverId} onChange={event => { setDriverId(event.target.value); setPlan(null); }}><option value="">Select driver</option>{drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></div><div className="form-field" style={{ alignSelf: 'end' }}><Button onClick={() => void generate()} disabled={busy}><Route size={14}/>{busy ? 'Calculating…' : 'Generate Mapbox route'}</Button></div></div></section>
    {plan && <section className="panel route-preview-panel" style={{ marginBottom: 18 }}><div className="route-map-wrap"><RouteMap routeCoordinates={plan.coordinates ?? []} stopCoordinates={plan.stopCoordinates ?? []}/></div><div className="route-preview-details"><span className="status status-teal">Draft route</span><strong>{distance} <span>·</span> {duration}</strong><p>Review stop markers and route geometry before approval. A one-stop route intentionally has no travel distance.</p></div></section>}
    <section className="panel"><div className="panel-heading"><div><h2>Add orders to route</h2><p>{selectedStops.length} of {stops.length} eligible orders selected</p></div>{stops.length > 0 && <div style={{ display: 'flex', gap: 8 }}><button className="button button-quiet" onClick={() => { setSelectedOrderIds(stops.map(order => order.internalId).filter((value): value is string => Boolean(value))); setPlan(null); }}>Select all</button><button className="button button-quiet" onClick={() => { setSelectedOrderIds([]); setPlan(null); }}>Clear</button></div>}</div><div className="table-wrap"><table><thead><tr><th>Add</th><th>Sequence</th><th>Order</th><th>Customer</th><th>Route destination</th><th>Status</th></tr></thead><tbody>{stops.map((order, index) => { const selected = Boolean(order.internalId && selectedOrderIds.includes(order.internalId)); return <tr key={order.id}><td><button className="route-select-button" aria-label={`${selected ? 'Remove' : 'Add'} ${order.id} from route`} onClick={() => toggle(order.internalId)}>{selected ? <CheckSquare size={18}/> : <Square size={18}/>}</button></td><td>{index + 1}</td><td>{order.id}</td><td>{order.customer}</td><td>{routeType === 'processor_pickup' ? `${order.processor} facility` : order.address}</td><td>{order.status}</td></tr>; })}</tbody></table>{!stops.length && <div className="empty">No orders are ready for this route type yet. Customer pickup requires Capacity confirmed; processor pickup requires Ready for pickup; delivery requires Picked up from processor.</div>}</div></section>
  </>;
}
