'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Map, Route } from 'lucide-react';
import { Button } from './ui/button';
import type { Order } from '@/lib/types';

type RouteType = 'pickup' | 'processor_pickup' | 'delivery';

export default function RoutePlannerPanel({ orders, notify, onApproveRoute }: { orders: Order[]; notify: (message: string) => void; onApproveRoute: (orderIds?: string[]) => void }) {
  const [routeType, setRouteType] = useState<RouteType>('pickup');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<{ durationSeconds?: number; distanceMeters?: number } | null>(null);
  const [driverId, setDriverId] = useState('');
  const [drivers, setDrivers] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => { void fetch('/api/drivers').then(response => response.ok ? response.json() : { drivers: [] }).then(body => setDrivers(body.drivers ?? [])); }, []);
  const stops = useMemo(() => orders.filter(order => routeType === 'pickup' ? order.status === 'Capacity confirmed' : routeType === 'processor_pickup' ? order.status === 'Ready for pickup' : order.status === 'Picked up from processor'), [orders, routeType]);

  async function generate() {
    const orderIds = stops.map(order => order.internalId).filter((value): value is string => Boolean(value));
    if (!orderIds.length) { notify('No eligible orders are available for this route'); return; }
    if (!driverId) { notify('Select a driver before generating the route'); return; }
    setBusy(true);
    const response = await fetch('/api/route-plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ routeDate: date, routeType, orderIds, driverId }) });
    const body = await response.json(); setBusy(false);
    if (!response.ok) { notify(body.error || 'Mapbox route generation failed'); return; }
    setPlan(body.route); notify('Mapbox route generated and saved for dispatcher review');
  }

  return <><div className="page-heading"><div><div className="eyebrow">Mapbox route operations</div><h1>Route planner</h1><p>Generate an integrated route, review the stops, then approve the work.</p></div><Button onClick={() => onApproveRoute(stops.map(order => order.id))} disabled={!plan}><Check size={14} />Approve eligible orders</Button></div><section className="panel" style={{ marginBottom: 18 }}><div className="panel-heading"><div><h2>Generate route</h2><p>Mapbox must be configured before a route can be created.</p></div><Map size={17} color="var(--teal)" /></div><div className="panel-body form-grid"><div className="form-field"><label>Route date</label><input className="form-control" type="date" value={date} onChange={event => setDate(event.target.value)} /></div><div className="form-field"><label>Route type</label><select className="form-control" value={routeType} onChange={event => setRouteType(event.target.value as RouteType)}><option value="pickup">Customer pickup</option><option value="processor_pickup">Processor pickup</option><option value="delivery">Customer delivery</option></select></div><div className="form-field"><label>Assigned driver</label><select className="form-control" value={driverId} onChange={event => setDriverId(event.target.value)}><option value="">Select driver</option>{drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></div><div className="form-field" style={{ alignSelf: 'end' }}><Button onClick={() => void generate()} disabled={busy}><Route size={14} />{busy ? 'Calculating…' : 'Generate Mapbox route'}</Button></div></div></section>{plan && <section className="panel" style={{ marginBottom: 18 }}><div className="panel-body"><strong>Route saved for review</strong><div className="customer-location">{plan.distanceMeters !== undefined ? `${Math.round((plan.distanceMeters ?? 0) / 1000)} km` : 'Distance available in Mapbox response'} · {plan.durationSeconds !== undefined ? `${Math.round((plan.durationSeconds ?? 0) / 60)} min` : 'Duration available in Mapbox response'}</div></div></section>}<section className="panel"><div className="panel-heading"><div><h2>Eligible stops</h2><p>{stops.length} orders selected for this route</p></div></div><div className="table-wrap"><table><thead><tr><th>Sequence</th><th>Order</th><th>Customer</th><th>Address</th><th>Status</th></tr></thead><tbody>{stops.map((order, index) => <tr key={order.id}><td>{index + 1}</td><td>{order.id}</td><td>{order.customer}</td><td>{order.address}</td><td>{order.status}</td></tr>)}</tbody></table>{!stops.length && <div className="empty">No orders are eligible for this route type.</div>}</div></section></>;
}
