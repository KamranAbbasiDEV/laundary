'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, CheckSquare, ChevronDown, ChevronUp, LoaderCircle, Route, Square, X } from 'lucide-react';
import { Button } from './ui/button';
import RouteMap from './route-map';
import { DateField } from './ui/date-field';
import type { Order } from '@/lib/types';
import { notifyDataChanged } from '@/lib/live-updates';

type RouteType = 'pickup' | 'processor_dropoff' | 'processor_pickup' | 'delivery';
type Draft = { id: string; durationSeconds?: number | null; distanceMeters?: number | null; coordinates?: [number, number][]; stopCoordinates?: [number, number][]; stops: Array<{ id: string; order_id: string; sequence: number }> };
const formatDistance = (meters?: number | null) => meters == null ? 'Distance unavailable' : meters === 0 ? 'No travel required' : meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
const formatDuration = (seconds?: number | null) => seconds == null ? 'Duration unavailable' : seconds === 0 ? 'No travel time' : seconds < 60 ? `${Math.max(1, Math.round(seconds))} sec` : `${Math.max(1, Math.round(seconds / 60))} min`;

export default function RoutePlannerPanel({ orders, notify }: { orders: Order[]; notify: (message: string) => void }) {
  const [routeType, setRouteType] = useState<RouteType>('pickup');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [driverId, setDriverId] = useState('');
  const [drivers, setDrivers] = useState<Array<{ id: string; name: string }>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const eligible = useMemo(() => orders.filter(order => routeType === 'pickup' ? order.status === 'Capacity confirmed' : routeType === 'processor_dropoff' ? order.status === 'Picked up' : routeType === 'processor_pickup' ? order.status === 'Ready for pickup' : order.status === 'Picked up from processor'), [orders, routeType]);
  const selectedOrders = eligible.filter(order => order.internalId && selected.includes(order.internalId));
  useEffect(() => { void fetch('/api/drivers').then(response => response.ok ? response.json() : { drivers: [] }).then(body => setDrivers(body.drivers ?? [])); }, []);
  useEffect(() => { setSelected([]); setDraft(null); }, [routeType]);
  const toggle = (id?: string) => { if (id) { setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]); setDraft(null); } };
  async function generate() {
    const orderIds = selectedOrders.map(order => order.internalId).filter((id): id is string => Boolean(id));
    if (!orderIds.length || !driverId) return notify('Select eligible orders and a driver first.');
    setBusy(true);
    try {
      const response = await fetch('/api/route-plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ routeDate: date, routeType, driverId, orderIds }) });
      const body = await response.json();
      if (!response.ok) return notify(body.error || 'Unable to generate route.');
      setDraft({ id: body.plan.id, ...body.route, stops: body.stops ?? [], stopCoordinates: (body.geocoded ?? []).flatMap((item: { coordinates?: [number, number] | null }) => item.coordinates ? [item.coordinates] : []) });
      notifyDataChanged();
      notify('Draft route generated. Review or reorder stops before approval.');
    } catch { notify('Unable to generate route.'); } finally { setBusy(false); }
  }
  async function reorder(index: number, delta: -1 | 1) {
    if (!draft) return;
    const target = index + delta;
    if (target < 0 || target >= draft.stops.length) return;
    const next = [...draft.stops];
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true);
    try {
      const response = await fetch('/api/route-plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reorder', planId: draft.id, stopIds: next.map(stop => stop.id) }) });
      const body = await response.json();
      if (!response.ok) return notify(body.error || 'Unable to reorder draft.');
      setDraft({ ...draft, stops: next.map((stop, sequence) => ({ ...stop, sequence: sequence + 1 })) });
      notifyDataChanged();
    } finally { setBusy(false); }
  }
  async function approve() {
    if (!draft) return;
    setBusy(true);
    try {
      const response = await fetch('/api/route-plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: draft.id }) });
      const body = await response.json();
      if (!response.ok) return notify(body.error || 'Unable to approve route.');
      notifyDataChanged(); notify('Route approved and assigned.'); setDraft(null);
    } finally { setBusy(false); }
  }
  async function cancel() {
    if (!draft) return;
    setBusy(true);
    try {
      const response = await fetch('/api/route-plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel', planId: draft.id, reason: 'Dispatcher cancelled draft route' }) });
      const body = await response.json();
      if (!response.ok) return notify(body.error || 'Unable to cancel draft.');
      notifyDataChanged(); setDraft(null); notify('Draft route cancelled.');
    } finally { setBusy(false); }
  }
  const destination = (order: Order) => routeType === 'processor_pickup' || routeType === 'processor_dropoff' ? `${order.processor} facility` : order.address;
  return <>
    <div className="page-heading"><div><div className="eyebrow">Mapbox route operations</div><h1>Route planner</h1><p>Generate, reorder, and approve the smallest practical route workflow.</p></div><Button onClick={() => void approve()} disabled={!draft || busy}>{busy ? <LoaderCircle className="spin" size={14}/> : <Check size={14}/>}Approve route</Button></div>
    <section className="panel" style={{ marginBottom: 18 }}><div className="panel-body form-grid"><div className="form-field"><label>Route date</label><DateField value={date} onChange={event => setDate(event.target.value)} aria-label="Route date" /></div><div className="form-field"><label>Route type</label><select className="form-control" value={routeType} onChange={event => setRouteType(event.target.value as RouteType)}><option value="pickup">Customer pickup</option><option value="processor_dropoff">Processor drop-off</option><option value="processor_pickup">Processor pickup</option><option value="delivery">Customer delivery</option></select></div><div className="form-field"><label>Driver</label><select className="form-control" value={driverId} onChange={event => setDriverId(event.target.value)}><option value="">Select driver</option>{drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></div><div className="form-field" style={{ alignSelf: 'end' }}><Button onClick={() => void generate()} disabled={busy || !driverId || !selectedOrders.length}>{busy ? <LoaderCircle className="spin" size={14}/> : <Route size={14}/>}Generate route</Button></div></div></section>
    {draft && <section className="panel route-preview-panel" style={{ marginBottom: 18 }}><div className="route-map-wrap"><RouteMap routeCoordinates={draft.coordinates ?? []} stopCoordinates={draft.stopCoordinates ?? []}/></div><div className="route-preview-details"><span className="status status-teal">Draft route</span><strong>{formatDistance(draft.distanceMeters)} · {formatDuration(draft.durationSeconds)}</strong>{draft.distanceMeters === 0 && <div className="customer-location">This route has one stop or all stops share the same location.</div>}<div className="route-list">{draft.stops.map((stop, index) => <div className="route-row" key={stop.id}><span className="route-index">{index + 1}</span><span>{orders.find(order => order.internalId === stop.order_id)?.id || 'Order'}</span><span style={{ marginLeft: 'auto' }}><button className="icon-button" disabled={busy || index === 0} onClick={() => void reorder(index, -1)}><ChevronUp size={15}/></button><button className="icon-button" disabled={busy || index === draft.stops.length - 1} onClick={() => void reorder(index, 1)}><ChevronDown size={15}/></button></span></div>)}</div><Button variant="outline" size="sm" onClick={() => void cancel()} disabled={busy}><X size={14}/>Cancel draft</Button></div></section>}
    <section className="panel"><div className="panel-heading"><div><h2>Eligible orders</h2><p>{selectedOrders.length} selected</p></div><button className="button button-quiet" onClick={() => setSelected(eligible.map(order => order.internalId).filter((id): id is string => Boolean(id)))}>Select all</button></div><div className="table-wrap"><table><thead><tr><th>Add</th><th>Order</th><th>Customer</th><th>Destination</th></tr></thead><tbody>{eligible.map(order => <tr key={order.id}><td><button className="route-select-button" onClick={() => toggle(order.internalId)}>{order.internalId && selected.includes(order.internalId) ? <CheckSquare size={18}/> : <Square size={18}/>}</button></td><td>{order.id}</td><td>{order.customer}</td><td>{destination(order)}</td></tr>)}</tbody></table>{!eligible.length && <div className="empty">No orders are eligible for this route type.</div>}</div></section>
  </>;
}
