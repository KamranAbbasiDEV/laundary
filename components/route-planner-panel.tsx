'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CheckSquare, ChevronDown, ChevronUp, LoaderCircle, Route, Square, X } from 'lucide-react';
import { Button } from './ui/button';
import RouteMap from './route-map';
import { DateField } from './ui/date-field';
import type { Order } from '@/lib/types';
import { notifyDataChanged } from '@/lib/live-updates';

type RouteType = 'pickup' | 'processor_dropoff' | 'processor_pickup' | 'delivery';
type Draft = { id: string; durationSeconds?: number | null; distanceMeters?: number | null; coordinates?: [number, number][]; stopCoordinates?: [number, number][]; stops: Array<{ id: string; order_id: string; sequence: number }> };
type RouteFocus = { orderId?: string; routeType?: RouteType };
type ExistingPlan = { id: string; route_date: string; route_type: RouteType; status: string; driver_id: string; mapbox_route?: { durationSeconds?: number | null; distanceMeters?: number | null; coordinates?: [number, number][] } | null; route_stops: Array<{ id: string; order_id: string; sequence: number; status: string; latitude?: number | null; longitude?: number | null }> };
const formatDistance = (meters?: number | null) => meters == null ? 'Distance unavailable' : meters === 0 ? 'No travel required' : meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
const formatDuration = (seconds?: number | null) => seconds == null ? 'Duration unavailable' : seconds === 0 ? 'No travel time' : seconds < 60 ? `${Math.max(1, Math.round(seconds))} sec` : `${Math.max(1, Math.round(seconds / 60))} min`;
const calendarDateInTimezone = (value: string | null | undefined, timezone: string) => { if (!value) return ''; try { const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value)); const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value])); return `${values.year}-${values.month}-${values.day}`; } catch { return calendarDateInTimezone(value, 'UTC'); } };

export default function RoutePlannerPanel({ orders, notify }: { orders: Order[]; notify: (message: string) => void }) {
  const [routeType, setRouteType] = useState<RouteType>('pickup');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [timezone, setTimezone] = useState('UTC');
  const [driverId, setDriverId] = useState('');
  const [drivers, setDrivers] = useState<Array<{ id: string; name: string }>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [plans, setPlans] = useState<ExistingPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const eligible = useMemo(() => orders.filter(order => {
    const statusEligible = routeType === 'pickup' ? order.status === 'Capacity confirmed' : routeType === 'processor_dropoff' ? order.status === 'Picked up' : routeType === 'processor_pickup' ? order.status === 'Ready for pickup' : order.status === 'Out for delivery';
    if (!statusEligible) return false;
    return routeType !== 'pickup' || !order.pickupWindowStartAt || calendarDateInTimezone(order.pickupWindowStartAt, timezone) === date;
  }), [orders, routeType, date, timezone]);
  const selectedOrders = eligible.filter(order => order.internalId && selected.includes(order.internalId));
  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const response = await fetch('/api/route-plans', { cache: 'no-store' });
      const body = await response.json();
      if (response.ok) setPlans(body.plans ?? []);
    } finally { setPlansLoading(false); }
  }, []);
  useEffect(() => { void fetch('/api/drivers').then(response => response.ok ? response.json() : { drivers: [] }).then(body => setDrivers(body.drivers ?? [])); }, []);
  useEffect(() => { void fetch('/api/settings', { cache: 'no-store' }).then(response => response.ok ? response.json() : null).then(body => { if (body?.settings?.timezone) setTimezone(body.settings.timezone); }); }, []);
  useEffect(() => { void loadPlans(); }, [loadPlans]);
  const openPlan = useCallback((plan: ExistingPlan) => {
    setRouteType(plan.route_type);
    setDate(plan.route_date);
    setDriverId(plan.driver_id);
    const orderedStops = [...plan.route_stops].sort((a, b) => a.sequence - b.sequence);
    setSelected(orderedStops.map(stop => stop.order_id));
    const route = plan.mapbox_route ?? {};
    setDraft({ id: plan.id, ...route, stops: orderedStops, stopCoordinates: orderedStops.flatMap(stop => typeof stop.longitude === 'number' && typeof stop.latitude === 'number' ? [[stop.longitude, stop.latitude] as [number, number]] : []) });
  }, []);
  useEffect(() => {
    const refresh = () => void loadPlans();
    window.addEventListener('rinseline:data-changed', refresh);
    return () => window.removeEventListener('rinseline:data-changed', refresh);
  }, [loadPlans]);
  useEffect(() => {
    if (plansLoading) return;
    const planFocus = window.localStorage.getItem('rinseline:route-plan-focus');
    if (planFocus) {
      const focusedPlan = plans.find(plan => plan.id === planFocus && plan.status === 'draft');
      if (focusedPlan) openPlan(focusedPlan);
      window.localStorage.removeItem('rinseline:route-plan-focus');
      if (focusedPlan) return;
    }
    const raw = window.localStorage.getItem('rinseline:route-focus');
    if (!raw) return;
    try {
      const focus = JSON.parse(raw) as RouteFocus;
      const order = orders.find(item => (item.internalId ?? item.id) === focus.orderId || item.id === focus.orderId);
      if (!order?.internalId) return;
      const nextType: RouteType = focus.routeType ?? (order.status === 'Ready for pickup' ? 'processor_pickup' : order.status === 'Out for delivery' ? 'delivery' : order.status === 'Picked up' ? 'processor_dropoff' : 'pickup');
      const existingDraft = plans.find(plan => plan.status === 'draft' && plan.route_type === nextType && plan.route_stops.some(stop => stop.order_id === order.internalId));
      if (existingDraft) {
        openPlan(existingDraft);
        window.localStorage.removeItem('rinseline:route-focus');
        return;
      }
      setRouteType(nextType);
      if (nextType === 'pickup' && order.pickupWindowStartAt) setDate(calendarDateInTimezone(order.pickupWindowStartAt, timezone));
      setSelected([order.internalId]);
      setDraft(null);
      window.localStorage.removeItem('rinseline:route-focus');
    } catch {
      window.localStorage.removeItem('rinseline:route-focus');
    }
  }, [openPlan, orders, plans, plansLoading, timezone]);
  const toggle = (id?: string) => { if (id && !draft) setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]); };
  const changeRouteType = (next: RouteType) => { if (!draft) { setRouteType(next); setSelected([]); } };
  async function generate() {
    const orderIds = selectedOrders.map(order => order.internalId).filter((id): id is string => Boolean(id));
    if (!orderIds.length || !driverId) return notify('Select eligible orders and a driver first.');
    setBusy(true);
    try {
      const response = await fetch('/api/route-plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ routeDate: date, routeType, driverId, orderIds }) });
      const body = await response.json();
      if (!response.ok) return notify(body.error || 'Unable to generate route.');
      setDraft({ id: body.plan.id, ...body.route, stops: body.stops ?? [], stopCoordinates: (body.geocoded ?? []).flatMap((item: { coordinates?: [number, number] | null }) => item.coordinates ? [item.coordinates] : []) });
      void loadPlans();
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
      setDraft({ ...draft, ...body.route, stops: next.map((stop, sequence) => ({ ...stop, sequence: sequence + 1 })), stopCoordinates: body.stopCoordinates ?? draft.stopCoordinates });
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
      notifyDataChanged(); notify('Route approved and assigned.'); setDraft(null); setSelected([]); await loadPlans();
    } finally { setBusy(false); }
  }
  async function cancel() {
    if (!draft) return;
    setBusy(true);
    try {
      const response = await fetch('/api/route-plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel', planId: draft.id, reason: 'Dispatcher cancelled draft route' }) });
      const body = await response.json();
      if (!response.ok) return notify(body.error || 'Unable to cancel draft.');
      notifyDataChanged(); setDraft(null); setSelected([]); notify('Draft route cancelled.'); await loadPlans();
    } finally { setBusy(false); }
  }
  const destination = (order: Order) => routeType === 'processor_pickup' || routeType === 'processor_dropoff' ? `${order.processor} facility` : order.address;
  return <>
    <section className="panel route-plan-register"><div className="panel-heading"><div><div className="eyebrow">Saved work</div><h2>Current routes</h2><p>Drafts can be reopened. Approved routes remain visible after their orders leave the planning queue.</p></div><span className="status status-teal">{plans.length} current</span></div><div className="focus-queue-list">{plans.map(plan => <div className="focus-queue-row route-plan-register-row" key={plan.id}><span className="focus-queue-order"><strong>{plan.route_date} · {plan.route_type.replaceAll('_', ' ')}</strong><small>{plan.route_stops.length} stop{plan.route_stops.length === 1 ? '' : 's'} · {drivers.find(driver => driver.id === plan.driver_id)?.name ?? 'Assigned driver'}</small></span><span className="focus-queue-context"><span className={`status status-${plan.status === 'approved' || plan.status === 'in_progress' ? 'teal' : plan.status === 'failed' ? 'red' : 'amber'}`}>{plan.status.replaceAll('_', ' ')}</span>{plan.status === 'draft' && <Button variant="outline" size="sm" onClick={() => openPlan(plan)}>Continue draft</Button>}</span></div>)}{!plans.length && <div className="empty compact-empty">{plansLoading ? 'Loading current routes…' : 'No current routes.'}</div>}</div></section>
    <section className="panel route-builder-controls"><div className="panel-heading"><div><div className="eyebrow">Step 1</div><h2>Route setup</h2><p>{draft ? 'This setup is locked to the open draft. Cancel it before changing the date, type, driver, or orders.' : 'Choose a route type and driver, then select eligible orders below.'}</p></div></div><div className="panel-body form-grid"><div className="form-field"><label>Route date</label><DateField value={date} onChange={event => setDate(event.target.value)} aria-label="Route date" disabled={Boolean(draft)} /></div><div className="form-field"><label>Route type</label><select className="form-control" value={routeType} onChange={event => changeRouteType(event.target.value as RouteType)} disabled={Boolean(draft)}><option value="pickup">Customer pickup</option><option value="processor_dropoff">Processor drop-off</option><option value="processor_pickup">Processor pickup</option><option value="delivery">Customer delivery</option></select></div><div className="form-field"><label>Driver</label><select className="form-control" value={driverId} onChange={event => setDriverId(event.target.value)} disabled={Boolean(draft)}><option value="">Select driver</option>{drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></div><div className="form-field" style={{ alignSelf: 'end' }}><Button onClick={() => void generate()} disabled={busy || Boolean(draft) || !driverId || !selectedOrders.length}>{busy ? <LoaderCircle className="spin" size={14}/> : <Route size={14}/>}Generate route</Button></div></div></section>
    {draft && <section className="panel route-preview-panel"><div className="route-map-wrap"><RouteMap routeCoordinates={draft.coordinates ?? []} stopCoordinates={draft.stopCoordinates ?? []}/></div><div className="route-preview-details"><span className="status status-teal">Draft route</span><strong>{formatDistance(draft.distanceMeters)} · {formatDuration(draft.durationSeconds)}</strong>{draft.distanceMeters === 0 && <div className="customer-location">This route has one stop or all stops share the same location.</div>}<div className="route-list">{draft.stops.map((stop, index) => <div className="route-row" key={stop.id}><span className="route-index">{index + 1}</span><span>{orders.find(order => order.internalId === stop.order_id)?.id || 'Order'}</span><span style={{ marginLeft: 'auto' }}><button className="icon-button" disabled={busy || index === 0} onClick={() => void reorder(index, -1)}><ChevronUp size={15}/></button><button className="icon-button" disabled={busy || index === draft.stops.length - 1} onClick={() => void reorder(index, 1)}><ChevronDown size={15}/></button></span></div>)}</div><div className="route-draft-actions"><Button variant="outline" size="sm" onClick={() => void cancel()} disabled={busy}><X size={14}/>Cancel</Button><Button size="sm" onClick={() => void approve()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={14}/> : <Check size={14}/>}Approve route</Button></div></div></section>}
    <section className="panel"><div className="panel-heading"><div><h2>Eligible orders</h2><p>{selectedOrders.length} selected</p></div><button className="button button-quiet" disabled={Boolean(draft)} onClick={() => setSelected(eligible.map(order => order.internalId).filter((id): id is string => Boolean(id)))}>Select all</button></div><div className="table-wrap"><table><thead><tr><th>Add</th><th>Order</th><th>Customer</th><th>Destination</th></tr></thead><tbody>{eligible.map(order => <tr key={order.id}><td><button className="route-select-button" disabled={Boolean(draft)} onClick={() => toggle(order.internalId)}>{order.internalId && selected.includes(order.internalId) ? <CheckSquare size={18}/> : <Square size={18}/>}</button></td><td>{order.id}</td><td>{order.customer}</td><td>{destination(order)}</td></tr>)}</tbody></table>{!eligible.length && <div className="empty">No orders are eligible for this route type.</div>}</div></section>
  </>;
}
