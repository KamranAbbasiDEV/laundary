'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Camera, LoaderCircle, MapPin, Navigation, PackageCheck, RefreshCw, Route } from 'lucide-react';
import { Button } from './ui/button';
import type { Order, OrderStatus } from '@/lib/types';
import RouteMap from './route-map';

type HandoffStage = 'customer_pickup' | 'processor_dropoff' | 'processor_pickup' | 'customer_delivery';
type Stage = { label: string; helper: string; handoff?: HandoffStage; next: OrderStatus; kind: string };
type DriverPlan = { id: string; route_date: string; route_type: string; status: string; driver_location?: { latitude: number; longitude: number } | null; route_stops: Array<{ id: string; sequence: number; status: string; address?: string | null; destination_name?: string | null; orders?: { order_number?: string } | Array<{ order_number?: string }> }> };

const stages: Partial<Record<OrderStatus, Stage>> = {
  'Pickup scheduled': { label: 'Complete customer pickup', helper: 'Photograph and count the bags before confirming pickup.', handoff: 'customer_pickup', next: 'Picked up', kind: 'customer-pickup' },
  'Picked up': { label: 'Complete processor drop-off', helper: 'Confirm the handoff quantity at the processor facility.', handoff: 'processor_dropoff', next: 'At processor', kind: 'processor-dropoff' },
  'Ready for pickup': { label: 'Complete processor pickup', helper: 'Reconcile the completed quantity before leaving the facility.', handoff: 'processor_pickup', next: 'Picked up from processor', kind: 'processor-pickup' },
  'Picked up from processor': { label: 'Confirm quality review', helper: 'Confirm the returned order is ready for delivery.', next: 'QC / Reconciliation', kind: 'qc' },
  'QC / Reconciliation': { label: 'Release for delivery', helper: 'Complete reconciliation before beginning final delivery.', next: 'Out for delivery', kind: 'qc' },
  'Out for delivery': { label: 'Complete customer delivery', helper: 'Photograph and count the delivered bags.', handoff: 'customer_delivery', next: 'Delivered', kind: 'customer-delivery' }
};

export default function DriverWorkflowPanel({ orders, notify, onStatusChange, onRefresh }: { orders: Order[]; notify: (message: string) => void; onStatusChange: (id: string, status: OrderStatus, note?: string) => Promise<void>; onRefresh: () => Promise<void> }) {
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [plans, setPlans] = useState<DriverPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedStopId, setSelectedStopId] = useState('');
  const [route, setRoute] = useState<{ coordinates: [number, number][]; stopCoordinates: [number, number][]; distanceMeters: number; durationSeconds: number } | null>(null);
  const [selectedLeg, setSelectedLeg] = useState<{ coordinates: [number, number][]; distanceMeters: number; durationSeconds: number } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [count, setCount] = useState('');
  const [note, setNote] = useState('');
  const [evidenceAttached, setEvidenceAttached] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(true);
  const [routeError, setRouteError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const [defect, setDefect] = useState({ type: 'damaged_item', severity: 'medium', description: '' });
  const [defectBusy, setDefectBusy] = useState(false);

  const activeStops = useMemo(() => {
    const routedOrderNumbers = new Set(plans.filter(plan => ['approved', 'in_progress'].includes(plan.status)).flatMap(plan => plan.route_stops.filter(stop => stop.status !== 'completed').flatMap(stop => {
      const order = Array.isArray(stop.orders) ? stop.orders[0] : stop.orders;
      return order?.order_number ? [order.order_number] : [];
    })));
    return orders.filter(order => {
      const stage = stages[order.status];
      return Boolean(stage) && (!stage?.handoff || routedOrderNumbers.has(order.id));
    });
  }, [orders, plans]);

  const selectedPlan = plans.find(plan => plan.id === selectedPlanId) ?? plans[0];
  const selectedStop = selectedPlan?.route_stops.find(stop => stop.id === selectedStopId) ?? selectedPlan?.route_stops.find(stop => stop.status !== 'completed') ?? selectedPlan?.route_stops[0];
  const selectedStopOrder = selectedStop ? (Array.isArray(selectedStop.orders) ? selectedStop.orders[0] : selectedStop.orders) : undefined;
  const selectedStopOrderNumber = selectedStopOrder?.order_number;
  const activeOrder = selectedStopOrderNumber
    ? orders.find(order => order.id === selectedStopOrderNumber)
    : orders.find(order => order.id === selectedOrderId) ?? activeStops[0];
  const action = activeOrder ? stages[activeOrder.status] : undefined;
  const selectedStopBlockedMessage = selectedPlan?.status === 'failed'
    ? 'Dispatch must recover this failed route before the stop can be completed.'
    : selectedStop?.status === 'completed'
      ? 'This stop is already complete.'
      : null;
  const selectedStopIndex = selectedPlan?.route_stops.findIndex(stop => stop.id === selectedStop?.id) ?? -1;
  const selectedStopCoordinate = selectedStopIndex >= 0 ? route?.stopCoordinates[selectedStopIndex] ?? null : null;
  const legOriginKey = currentLocation ? currentLocation.map(value => value.toFixed(4)).join(',') : '';

  useEffect(() => {
    const focus = window.localStorage.getItem('rinseline:global-order-focus');
    if (!focus) return;
    const target = activeStops.find(order => (order.internalId ?? order.id) === focus || order.id === focus);
    window.localStorage.removeItem('rinseline:global-order-focus');
    if (target) setSelectedOrderId(target.id);
  }, [activeStops]);
  useEffect(() => { setCount(''); setNote(''); setEvidenceAttached(false); }, [activeOrder?.id]);
  useEffect(() => {
    let active = true;
    setLoadingRoute(true);
    void fetch('/api/route-plans', { cache: 'no-store' }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to load your route.'); return body; }).then(body => { if (!active) return; const next = body.plans ?? []; setPlans(next); setSelectedPlanId(current => next.some((plan: DriverPlan) => plan.id === current) ? current : next.find((plan: DriverPlan) => ['approved', 'in_progress'].includes(plan.status))?.id ?? next[0]?.id ?? ''); }).catch(reason => { if (active) setRouteError(reason instanceof Error ? reason.message : 'Unable to load your route.'); }).finally(() => { if (active) setLoadingRoute(false); });
    return () => { active = false; };
  }, [refreshTick]);
  useEffect(() => {
    if (!selectedPlan) { setRoute(null); setSelectedStopId(''); return; }
    const nextStop = selectedPlan.route_stops.find(stop => stop.id === selectedStopId) ?? selectedPlan.route_stops.find(stop => stop.status !== 'completed') ?? selectedPlan.route_stops[0];
    setSelectedStopId(nextStop?.id ?? '');
    const nextOrder = nextStop ? (Array.isArray(nextStop.orders) ? nextStop.orders[0] : nextStop.orders) : undefined;
    setSelectedOrderId(nextOrder?.order_number ?? '');
    setCurrentLocation(selectedPlan.driver_location ? [selectedPlan.driver_location.longitude, selectedPlan.driver_location.latitude] : null);
    const addresses = selectedPlan.route_stops.map(stop => stop.address).filter((address): address is string => Boolean(address));
    if (!addresses.length) { setRoute(null); return; }
    let active = true;
    void fetch('/api/routes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ addresses }) }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to map this route.'); return body; }).then(body => { if (!active) return; setRoute({ coordinates: body.route?.coordinates ?? [], stopCoordinates: (body.geocoded ?? []).map((item: { coordinates: [number, number] }) => item.coordinates), distanceMeters: body.route?.distanceMeters ?? 0, durationSeconds: body.route?.durationSeconds ?? 0 }); setRouteError(''); }).catch(reason => { if (active) setRouteError(reason instanceof Error ? reason.message : 'Unable to map this route.'); });
    return () => { active = false; };
  }, [selectedPlan]);
  useEffect(() => {
    const stop = selectedPlan?.route_stops.find(item => item.id === selectedStopId);
    if (!currentLocation || !stop?.address) { setSelectedLeg(null); return; }
    let active = true;
    void fetch('/api/routes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ addresses: [stop.address], origin: currentLocation }) }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to map the selected stop.'); return body; }).then(body => { if (active) setSelectedLeg({ coordinates: body.route?.coordinates ?? [], distanceMeters: body.route?.distanceMeters ?? 0, durationSeconds: body.route?.durationSeconds ?? 0 }); }).catch(() => { if (active) setSelectedLeg(null); });
    return () => { active = false; };
  }, [legOriginKey, selectedPlan, selectedStopId]);
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(({ coords }) => setCurrentLocation([coords.longitude, coords.latitude]), () => undefined, { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 });
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  async function refresh() { setBusy(true); try { await onRefresh(); setRefreshTick(value => value + 1); } finally { setBusy(false); } }
  async function recordLocation(orderId: string) {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async ({ coords }) => { try { await fetch('/api/driver-location', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, latitude: coords.latitude, longitude: coords.longitude, accuracyMeters: coords.accuracy }) }); } catch { /* location is supplemental */ } }, () => undefined, { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 });
  }
  async function upload(file: File | undefined) {
    if (!file || !activeOrder?.internalId || !action) return;
    setUploading(true);
    const form = new FormData(); form.append('file', file); form.append('orderId', activeOrder.internalId); form.append('kind', action.kind);
    try { const response = await fetch('/api/photos', { method: 'POST', body: form }); const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Photo upload failed.'); setEvidenceAttached(true); notify('Photo attached.'); } catch (error) { notify(error instanceof Error ? error.message : 'Photo upload failed.'); } finally { setUploading(false); }
  }
  async function confirm() {
    if (!activeOrder?.internalId || !action) return notify('This stop is missing its operational identifier.');
    if (action.handoff && !evidenceAttached) return notify('Attach the required handoff photo first.');
    setBusy(true);
    try {
      if (action.handoff) {
        const selectedStop = selectedPlan?.route_stops.find(stop => { const order = Array.isArray(stop.orders) ? stop.orders[0] : stop.orders; return stop.id === selectedStopId && order?.order_number === activeOrder.id; });
        const arrival = await fetch('/api/route-stops', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: activeOrder.internalId, routeStopId: selectedStop?.id }) });
        const arrivalBody = await arrival.json();
        if (!arrival.ok) throw new Error(arrivalBody.error || 'Unable to record arrival.');
        void recordLocation(activeOrder.internalId);
        const actualBags = Number(count === '' ? activeOrder.bags : count);
        const discrepancy = actualBags !== activeOrder.bags ? note || `Expected ${activeOrder.bags}; recorded ${actualBags}.` : undefined;
        const handoff = await fetch('/api/handoffs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: activeOrder.internalId, stage: action.handoff, actualBags, discrepancy, notes: note || undefined }) });
        const handoffBody = await handoff.json();
        if (!handoff.ok) throw new Error(handoffBody.error || 'Unable to save this handoff.');
      }
      await onStatusChange(activeOrder.id, action.next, note || `Recorded count: ${count === '' ? activeOrder.bags : count}`);
      setCount(''); setNote(''); setEvidenceAttached(false); setRefreshTick(value => value + 1);
    } catch (error) { notify(error instanceof Error ? error.message : 'Unable to complete this stop.'); } finally { setBusy(false); }
  }
  async function submitDefect() {
    if (!activeOrder?.internalId || defect.description.trim().length < 3) return notify('Describe the issue first.');
    setDefectBusy(true);
    try { const response = await fetch('/api/exceptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: activeOrder.internalId, type: defect.type, stage: activeOrder.status, description: defect.description.trim(), severity: defect.severity }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to report issue.'); setDefect(current => ({ ...current, description: '' })); notify('Issue sent to dispatch.'); await onRefresh(); } catch (error) { notify(error instanceof Error ? error.message : 'Unable to report issue.'); } finally { setDefectBusy(false); }
  }
  function selectRouteStop(stop: DriverPlan['route_stops'][number]) {
    setSelectedStopId(stop.id);
    const order = Array.isArray(stop.orders) ? stop.orders[0] : stop.orders;
    setSelectedOrderId(order?.order_number ?? '');
  }
  function selectRoutePlan(planId: string) {
    const plan = plans.find(item => item.id === planId);
    const nextStop = plan?.route_stops.find(stop => stop.status !== 'completed') ?? plan?.route_stops[0];
    setSelectedPlanId(planId);
    setSelectedStopId(nextStop?.id ?? '');
    const order = nextStop ? (Array.isArray(nextStop.orders) ? nextStop.orders[0] : nextStop.orders) : undefined;
    setSelectedOrderId(order?.order_number ?? '');
  }

  const displayedRoute = selectedLeg ?? route;
  const distance = displayedRoute ? displayedRoute.distanceMeters < 1000 ? `${Math.round(displayedRoute.distanceMeters)} m` : `${(displayedRoute.distanceMeters / 1000).toFixed(1)} km` : '—';
  const duration = displayedRoute ? `${Math.max(1, Math.round(displayedRoute.durationSeconds / 60))} min` : '—';

  return <div className="role-workspace driver-portal-shell"><div className="page-heading role-page-heading"><div><div className="eyebrow">Driver workspace</div><h1>Today’s route</h1><p>Your route and current stop stay together. Complete one required action at a time.</p></div><div className="row-actions"><span className="status status-teal">{activeStops.length} active</span><Button variant="outline" size="sm" onClick={() => void refresh()} disabled={busy}><RefreshCw className={busy ? 'spin' : ''} size={14}/>Refresh</Button></div></div><div className="driver-command-layout"><section className="panel driver-route-panel"><div className="panel-heading"><div><div className="eyebrow">Route overview</div><h2><Route size={16}/>Map and stops</h2></div>{loadingRoute && <LoaderCircle className="spin" size={16}/>}</div>{plans.length > 1 && <div className="driver-route-controls"><label><span>Route</span><select className="form-control" value={selectedPlan?.id ?? ''} onChange={event => selectRoutePlan(event.target.value)}>{plans.map(plan => <option key={plan.id} value={plan.id}>{plan.route_date} · {plan.route_type.replaceAll('_', ' ')}</option>)}</select></label></div>}{routeError ? <div className="empty compact-empty">{routeError}</div> : selectedPlan && route ? <><div className="driver-route-map-summary"><div><span>{selectedLeg ? 'Distance to stop' : 'Route distance'}</span><strong>{distance}</strong></div><div><span>{selectedLeg ? 'Time to stop' : 'Route time'}</span><strong>{duration}</strong></div><div><span>GPS</span><strong>{currentLocation ? 'Live' : 'Waiting'}</strong></div></div><div className="route-map-wrap driver-route-map"><RouteMap routeCoordinates={selectedLeg?.coordinates ?? route.coordinates} stopCoordinates={route.stopCoordinates} currentLocation={currentLocation} selectedStopIndex={selectedStopIndex} focusCoordinate={selectedStopCoordinate}/></div><div className="driver-route-stops"><div className="driver-route-stops-heading"><strong>Stops</strong><small>{selectedPlan.route_stops.length} assigned</small></div>{selectedPlan.route_stops.map(stop => { const order = Array.isArray(stop.orders) ? stop.orders[0] : stop.orders; return <button className={`driver-route-stop ${stop.id === selectedStop?.id ? 'selected' : ''}`} type="button" key={stop.id} onClick={() => selectRouteStop(stop)}><span className="route-index">{stop.sequence}</span><span><strong>{order?.order_number ?? 'Assigned order'}</strong><small>{stop.destination_name ?? 'Route stop'} · {stop.address ?? 'Address unavailable'}</small></span><em>{stop.status}</em></button>; })}</div></> : <div className="empty compact-empty">{loadingRoute ? 'Loading your route…' : 'No active route is assigned.'}</div>}</section><div className="driver-action-column">{activeOrder && action ? <section className="panel driver-task"><div className="driver-task-header"><span className="route-index"><Navigation size={15}/></span><div><div className="eyebrow">Current stop</div><h2>{action.label}</h2><p>{activeOrder.customer} · {activeOrder.address}</p></div></div><p className="driver-task-helper">{selectedStopBlockedMessage ?? action.helper}</p><div className="driver-task-summary"><div><span>Order</span><strong>{activeOrder.id}</strong></div><div><span>Expected</span><strong>{activeOrder.bags} bags</strong></div><div><span>Due</span><strong>{activeOrder.due || 'Not set'}</strong></div></div>{activeOrder.notes && <div className="driver-instruction"><strong>Instructions</strong><span>{activeOrder.notes}</span></div>}<div className="driver-task-form">{action.handoff && <label className="form-field"><span>Actual bag count</span><input className="form-control" type="number" min="0" inputMode="numeric" value={count === '' ? activeOrder.bags : count} onChange={event => setCount(event.target.value)}/></label>}<label className="form-field"><span>Photo evidence {action.handoff ? '· required' : '· optional'}</span><span className="photo-input"><Camera size={15}/>{uploading ? 'Uploading…' : evidenceAttached ? 'Photo attached' : 'Add photo'}<input type="file" accept="image/*" capture="environment" disabled={uploading || Boolean(selectedStopBlockedMessage)} onChange={event => void upload(event.target.files?.[0])}/></span></label><label className="form-field full"><span>Handoff note</span><textarea className="form-control" value={note} onChange={event => setNote(event.target.value)} placeholder="Only add a note when dispatch needs context."/></label><Button size="lg" onClick={() => void confirm()} disabled={busy || uploading || Boolean(selectedStopBlockedMessage) || Boolean(action.handoff && !evidenceAttached)}><PackageCheck size={16}/>{busy ? 'Saving…' : action.label}</Button></div></section> : <section className="panel"><div className="empty compact-empty">{selectedStopOrderNumber ? `Order ${selectedStopOrderNumber} is not available for action.` : 'No active stop needs an action.'}</div></section>}<details className="panel driver-issue-disclosure"><summary><span><AlertTriangle size={16}/>Report an issue</span><small>Damage, discrepancy, access or route problem</small></summary>{activeOrder ? <div className="driver-issue-form"><div className="form-grid"><label className="form-field"><span>Type</span><select className="form-control" value={defect.type} onChange={event => setDefect(current => ({ ...current, type: event.target.value }))}><option value="damaged_item">Damaged item</option><option value="pickup_discrepancy">Quantity discrepancy</option><option value="route_issue">Route or access issue</option></select></label><label className="form-field"><span>Severity</span><select className="form-control" value={defect.severity} onChange={event => setDefect(current => ({ ...current, severity: event.target.value }))}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label><label className="form-field full"><span>What happened?</span><textarea className="form-control" value={defect.description} onChange={event => setDefect(current => ({ ...current, description: event.target.value }))}/></label></div><Button onClick={() => void submitDefect()} disabled={defectBusy}>{defectBusy ? 'Submitting…' : 'Send to dispatch'}</Button></div> : <div className="empty compact-empty">Select an active order first.</div>}</details></div></div></div>;
}
