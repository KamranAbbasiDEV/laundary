'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Camera, ChevronRight, LoaderCircle, MapPin, PackageCheck, RefreshCw, Route } from 'lucide-react';
import { Button } from './ui/button';
import type { Order, OrderStatus } from '@/lib/types';
import DeadlineRolePanel from './deadline-role-panel';
import RouteMap from './route-map';

type HandoffStage = 'customer_pickup' | 'processor_dropoff' | 'processor_pickup' | 'customer_delivery';
type Stage = { label: string; helper: string; handoff?: HandoffStage; next: OrderStatus; kind: string };
const stages: Record<string, Stage> = {
  'Pickup scheduled': { label: 'Complete customer pickup', helper: 'Record the bag count and required photo. Arrival is logged automatically.', handoff: 'customer_pickup', next: 'Picked up', kind: 'customer-pickup' },
  'Picked up': { label: 'Complete processor drop-off', helper: 'Record the handoff count and required photo at the facility.', handoff: 'processor_dropoff', next: 'At processor', kind: 'processor-dropoff' },
  'Ready for pickup': { label: 'Complete processor pickup', helper: 'Record the completed quantity and required photo.', handoff: 'processor_pickup', next: 'Picked up from processor', kind: 'processor-pickup' },
  'Picked up from processor': { label: 'Confirm quality review', helper: 'Confirm the returned order is ready for delivery.', next: 'QC / Reconciliation', kind: 'qc' },
  'QC / Reconciliation': { label: 'Release for delivery', helper: 'Confirm reconciliation to begin final delivery.', next: 'Out for delivery', kind: 'qc' },
  'Out for delivery': { label: 'Complete customer delivery', helper: 'Record the final count and required delivery photo.', handoff: 'customer_delivery', next: 'Delivered', kind: 'customer-delivery' }
};

function LegacyDriverWorkflowPanel({ orders, notify, onStatusChange, onRefresh }: { orders: Order[]; notify: (message: string) => void; onStatusChange: (id: string, status: OrderStatus, note?: string) => Promise<void>; onRefresh: () => Promise<void> }) {
  const activeStops = useMemo(() => orders.filter((order) => Boolean(stages[order.status])), [orders]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [count, setCount] = useState(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  const [evidenceAttached, setEvidenceAttached] = useState(false); const [uploading, setUploading] = useState(false); const [refreshing, setRefreshing] = useState(false);
  const activeOrder = activeStops.find((order) => order.id === selectedId) ?? activeStops[0];
  useEffect(() => { setCount(''); setNote(''); setEvidenceAttached(false); }, [activeOrder?.id]);
  useEffect(() => {
    const focus = window.localStorage.getItem('rinseline:global-order-focus');
    if (!focus) return;
    const target = activeStops.find(order => (order.internalId ?? order.id) === focus || order.id === focus);
    window.localStorage.removeItem('rinseline:global-order-focus');
    if (!target) return;
    setSelectedId(target.id);
  }, [activeStops]);
  async function refreshStops() { setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } }
  if (!activeOrder) return <section className="panel"><div className="panel-heading"><div><h2>Stops</h2><p>New work will appear here automatically.</p></div><Button variant="outline" size="sm" onClick={() => void refreshStops()} disabled={refreshing}><RefreshCw className={refreshing ? 'spin' : ''} size={14}/>Refresh</Button></div><div className="panel-body"><div className="empty">No stops are assigned to you right now.</div></div></section>;
  const action = stages[activeOrder.status];

  async function recordLocation(orderId: string) {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try { await fetch('/api/driver-location', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, latitude: coords.latitude, longitude: coords.longitude, accuracyMeters: coords.accuracy }) }); } catch { /* GPS is supplemental; handoff evidence is authoritative. */ }
    }, () => undefined, { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 });
  }

  async function upload(file: File | undefined) {
    if (!file || !activeOrder.internalId) return;
    setUploading(true); const form = new FormData(); form.append('file', file); form.append('orderId', activeOrder.internalId); form.append('kind', action.kind);
    try {
      const response = await fetch('/api/photos', { method: 'POST', body: form }); const body = await response.json();
      if (response.ok) { setEvidenceAttached(true); notify('Required photo attached. You can now complete this stop.'); } else notify(body.error || 'Photo upload failed.');
    } catch { notify('Photo upload failed. Please try again.'); } finally { setUploading(false); }
  }

  async function confirm() {
    if (!activeOrder.internalId) return notify('This stop is missing its operational identifier.');
    if (action.handoff && !evidenceAttached) return notify('Attach the required handoff photo before completing this stop.');
    setBusy(true);
    try {
      if (action.handoff) {
        {
          const arrival = await fetch('/api/route-stops', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: activeOrder.internalId }) });
          const arrivalBody = await arrival.json();
          if (!arrival.ok) return notify(arrivalBody.error || 'Unable to record arrival for this stop.');
          void recordLocation(activeOrder.internalId);
        }
        const actualBags = Number(count === '' ? activeOrder.bags : count);
        const discrepancy = actualBags !== activeOrder.bags ? note || `Expected ${activeOrder.bags}; recorded ${actualBags}.` : undefined;
        const handoff = await fetch('/api/handoffs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: activeOrder.internalId, stage: action.handoff, actualBags, discrepancy, notes: note || undefined }) });
        const handoffBody = await handoff.json();
        if (!handoff.ok) return notify(handoffBody.error || 'Unable to save this handoff.');
      }
      await onStatusChange(activeOrder.id, action.next, note || `Recorded count: ${count === '' ? activeOrder.bags : count}`);
      setCount(''); setNote(''); setEvidenceAttached(false);
    } catch { notify('Unable to complete this stop. Please try again.'); } finally { setBusy(false); }
  }

  return <><div className="page-heading"><div><div className="eyebrow">Driver workspace</div><h1>Today’s route</h1><p>{activeStops.length} active {activeStops.length === 1 ? 'stop' : 'stops'} assigned. One primary action completes each stop.</p></div><div className="row-actions"><span className="status status-teal">{activeStops.length} active</span><Button variant="outline" size="sm" onClick={() => void refreshStops()} disabled={refreshing}><RefreshCw className={refreshing ? 'spin' : ''} size={14}/>Refresh</Button></div></div><div className="driver-workspace"><aside className="driver-stop-list panel"><div className="panel-heading"><div><h2>Stops</h2><p>Select a stop to complete its next task.</p></div></div><div className="driver-stop-items">{activeStops.map((order, index) => <button className={`driver-stop ${order.id === activeOrder.id ? 'selected' : ''}`} key={order.id} onClick={() => setSelectedId(order.id)}><span className="route-index">{index + 1}</span><span><strong>{order.customer}</strong><small>{order.address}</small><em>{stages[order.status].label}</em></span><ChevronRight size={16}/></button>)}</div></aside><section className="driver-task panel"><div className="driver-task-header"><span className="route-index"><MapPin size={15}/></span><div><div className="eyebrow">Next task</div><h2>{action.label}</h2><p>{activeOrder.customer} · {activeOrder.address}</p></div></div><div className="driver-task-summary"><div><span>Order</span><strong>{activeOrder.id}</strong></div><div><span>Expected quantity</span><strong>{activeOrder.bags} bags</strong></div><div><span>Instructions</span><strong>{activeOrder.notes || 'No special instructions'}</strong></div></div><div className="panel-body form-grid">{action.handoff && <div className="form-field"><label>Actual bag count</label><input className="form-control" type="number" min="0" inputMode="numeric" value={count === '' ? activeOrder.bags : count} onWheel={(event) => event.currentTarget.blur()} onChange={(event) => setCount(event.target.value)}/></div>}<div className={action.handoff ? 'form-field' : 'form-field full'}><label>Photo evidence {action.handoff ? <span className="required">required</span> : <span className="optional">optional</span>}</label><label className="photo-input"><Camera size={15}/>{uploading ? 'Uploading…' : evidenceAttached ? 'Photo attached' : action.handoff ? 'Add required photo' : 'Add photo'}<input type="file" accept="image/*" capture="environment" disabled={uploading} onChange={(event) => void upload(event.target.files?.[0])}/></label></div><div className="form-field full"><label>Issue or handoff note</label><textarea className="form-control" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Only add a note when operations needs to know something."/></div><div className="form-field full"><Button size="lg" onClick={() => void confirm()} disabled={busy || uploading || Boolean(action.handoff && !evidenceAttached)}><PackageCheck size={16}/>{busy ? 'Saving stop…' : action.label}</Button>{action.handoff && <small className="driver-auto-checkin">A photo and arrival are recorded before this handoff is confirmed.</small>}</div></div></section></div></>;
}

function DriverDefectReporter({ orders, notify, onRefresh }: { orders: Order[]; notify: (message: string) => void; onRefresh: () => Promise<void> }) {
  const assigned = orders.filter(order => Boolean(order.internalId));
  const [orderId, setOrderId] = useState(assigned[0]?.internalId ?? ''); const [description, setDescription] = useState(''); const [type, setType] = useState<'damaged_item' | 'route_issue' | 'pickup_discrepancy'>('damaged_item'); const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium'); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!assigned.some(order => order.internalId === orderId)) setOrderId(assigned[0]?.internalId ?? ''); }, [assigned, orderId]);
  async function submit() { if (!orderId || description.trim().length < 3) return notify('Select an order and describe the defect.'); setBusy(true); try { const response = await fetch('/api/exceptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, type, stage: assigned.find(order => order.internalId === orderId)?.status, description: description.trim(), severity }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to report defect.'); setDescription(''); notify('Defect reported to dispatch.'); await onRefresh(); } catch (error) { notify(error instanceof Error ? error.message : 'Unable to report defect.'); } finally { setBusy(false); } }
  return <section className="panel driver-defect-reporter"><div className="panel-heading"><div><h2><AlertTriangle size={16}/> Report a defect</h2><p>Send damage, missing-item, discrepancy, or route issues directly to dispatch.</p></div></div><div className="panel-body form-grid"><label><span>Order</span><select className="form-control" value={orderId} onChange={event => setOrderId(event.target.value)}>{assigned.map(order => <option key={order.internalId} value={order.internalId}>{order.id} · {order.customer}</option>)}</select></label><label><span>Type</span><select className="form-control" value={type} onChange={event => setType(event.target.value as typeof type)}><option value="damaged_item">Damaged item</option><option value="pickup_discrepancy">Pickup discrepancy</option><option value="route_issue">Route or access issue</option></select></label><label><span>Severity</span><select className="form-control" value={severity} onChange={event => setSeverity(event.target.value as typeof severity)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label><label className="form-field full"><span>Description</span><textarea className="form-control" value={description} onChange={event => setDescription(event.target.value)} placeholder="Describe what happened and what dispatch needs to know." /></label><div className="form-field full"><Button type="button" onClick={() => void submit()} disabled={busy || !assigned.length}>{busy ? 'Submitting…' : 'Submit defect report'}</Button></div></div></section>;
}

type DriverPlan = { id: string; route_date: string; route_type: string; status: string; driver_location?: { latitude: number; longitude: number } | null; mapbox_route?: { coordinates?: [number, number][] } | null; route_stops: Array<{ id: string; sequence: number; status: string; address?: string | null; destination_name?: string | null; orders?: { order_number?: string } | Array<{ order_number?: string }> }> };

function DriverRouteMapPanel() {
  const [plans, setPlans] = useState<DriverPlan[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [route, setRoute] = useState<{ coordinates: [number, number][]; stopCoordinates: [number, number][] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const selected = plans.find(plan => plan.id === selectedId) ?? plans[0];
  useEffect(() => { const refresh = () => setRefreshTick(value => value + 1); window.addEventListener('rinseline:data-changed', refresh); return () => window.removeEventListener('rinseline:data-changed', refresh); }, []);
  useEffect(() => {
    let active = true;
    void fetch('/api/route-plans', { cache: 'no-store' }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to load your route.'); return body; }).then(body => { if (!active) return; const next = body.plans ?? []; setPlans(next); setSelectedId(next[0]?.id ?? ''); }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load your route.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshTick]);
  useEffect(() => {
    if (!selected) { setRoute(null); return; }
    const addresses = selected.route_stops.map(stop => stop.address).filter((address): address is string => Boolean(address));
    if (!addresses.length) { setRoute(null); return; }
    let active = true;
    void fetch('/api/routes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ addresses }) }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to map this route.'); return body; }).then(body => { if (!active) return; setRoute({ coordinates: body.route?.coordinates ?? [], stopCoordinates: (body.geocoded ?? []).map((item: { coordinates: [number, number] }) => item.coordinates) }); setError(''); }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to map this route.'); });
    return () => { active = false; };
  }, [selected]);
  return <section className="panel driver-route-panel"><div className="panel-heading"><div><div className="eyebrow">Live route map</div><h2><Route size={16}/>Where you are going</h2><p>Pickup, processor handoff, processor pickup, and delivery destinations for your assigned route.</p></div>{loading && <LoaderCircle className="spin" size={16}/>}</div>{plans.length > 1 && <div className="panel-body driver-route-controls"><label><span>Route</span><select className="form-control" value={selected?.id ?? ''} onChange={event => setSelectedId(event.target.value)}>{plans.map(plan => <option key={plan.id} value={plan.id}>{plan.route_date} · {plan.route_type.replaceAll('_', ' ')} · {plan.status}</option>)}</select></label></div>}{error ? <div className="panel-body"><div className="empty">{error}</div></div> : selected && route ? <><div className="route-map-wrap driver-route-map"><RouteMap routeCoordinates={route.coordinates} stopCoordinates={route.stopCoordinates}/></div><div className="driver-route-stops">{selected.route_stops.map(stop => { const order = Array.isArray(stop.orders) ? stop.orders[0] : stop.orders; return <div className="driver-route-stop" key={stop.id}><span className="route-index">{stop.sequence}</span><span><strong>{order?.order_number ?? 'Assigned order'}</strong><small>{stop.destination_name ?? 'Route stop'} · {stop.address ?? 'Address unavailable'}</small></span><em>{stop.status}</em></div>; })}</div></> : <div className="panel-body"><div className="empty">{loading ? 'Loading your assigned route…' : 'No active route has been assigned yet.'}</div></div>}</section>;
}

export default function DriverWorkflowPanel(props: { orders: Order[]; notify: (message: string) => void; onStatusChange: (id: string, status: OrderStatus, note?: string) => Promise<void>; onRefresh: () => Promise<void> }) {
  return <div className="driver-portal-shell"><DeadlineRolePanel role="driver" orders={props.orders}/><DriverRouteMapPanel/><div className="driver-legacy-shell"><LegacyDriverWorkflowPanel {...props}/><DriverDefectReporter orders={props.orders} notify={props.notify} onRefresh={props.onRefresh}/></div></div>;
}
