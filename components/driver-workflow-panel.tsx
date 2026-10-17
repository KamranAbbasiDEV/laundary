'use client';

import { useEffect, useMemo, useState } from 'react';
import { Camera, ChevronRight, MapPin, PackageCheck } from 'lucide-react';
import { Button } from './ui/button';
import type { Order, OrderStatus } from '@/lib/types';

type Stage = { label: string; helper: string; handoff?: 'customer_pickup' | 'processor_dropoff' | 'processor_pickup' | 'customer_delivery'; next: OrderStatus; kind: string };
const stages: Record<string, Stage> = {
  'Pickup scheduled': { label: 'Complete customer pickup', helper: 'Confirm the bag count and continue. Arrival is logged automatically.', handoff: 'customer_pickup', next: 'Picked up', kind: 'customer-pickup' },
  'Picked up': { label: 'Complete processor drop-off', helper: 'Confirm the handoff count at the assigned facility.', handoff: 'processor_dropoff', next: 'At processor', kind: 'processor-dropoff' },
  'Ready for pickup': { label: 'Complete processor pickup', helper: 'Confirm the completed quantity and continue.', handoff: 'processor_pickup', next: 'Picked up from processor', kind: 'processor-pickup' },
  'Picked up from processor': { label: 'Confirm quality review', helper: 'Confirm the returned order is ready for delivery.', next: 'QC / Reconciliation', kind: 'qc' },
  'QC / Reconciliation': { label: 'Release for delivery', helper: 'Confirm reconciliation to begin final delivery.', next: 'Out for delivery', kind: 'qc' },
  'Out for delivery': { label: 'Complete customer delivery', helper: 'Confirm delivery and the final handoff count.', handoff: 'customer_delivery', next: 'Delivered', kind: 'customer-delivery' }
};

export default function DriverWorkflowPanel({ orders, notify, onStatusChange }: { orders: Order[]; notify: (message: string) => void; onStatusChange: (id: string, status: OrderStatus, note?: string) => Promise<void> }) {
  const activeStops = useMemo(() => orders.filter((order) => Boolean(stages[order.status])), [orders]);
  const [selectedId, setSelectedId] = useState<string | null>(null); const [count, setCount] = useState(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  const activeOrder = activeStops.find((order) => order.id === selectedId) ?? activeStops[0];
  useEffect(() => { setCount(''); setNote(''); }, [activeOrder?.id]);
  if (!activeOrder) return <section className="panel"><div className="panel-body"><div className="empty">No stops are assigned to you right now. New work will appear here automatically.</div></div></section>;
  const action = stages[activeOrder.status];

  async function confirm() {
    if (!activeOrder.internalId) return notify('This stop is missing its operational identifier.');
    setBusy(true);
    try {
      if (action.handoff) {
        const arrival = await fetch('/api/route-stops', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: activeOrder.internalId }) });
        const arrivalBody = await arrival.json();
        if (!arrival.ok) return notify(arrivalBody.error || 'Unable to record arrival for this stop.');
        const actualBags = Number(count === '' ? activeOrder.bags : count);
        const discrepancy = actualBags !== activeOrder.bags ? note || `Expected ${activeOrder.bags}; recorded ${actualBags}.` : undefined;
        const handoff = await fetch('/api/handoffs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: activeOrder.internalId, stage: action.handoff, actualBags, discrepancy, notes: note || undefined }) });
        const handoffBody = await handoff.json();
        if (!handoff.ok) return notify(handoffBody.error || 'Unable to save this handoff.');
      }
      await onStatusChange(activeOrder.id, action.next, note || `Recorded count: ${count === '' ? activeOrder.bags : count}`);
      setCount(''); setNote('');
    } catch { notify('Unable to complete this stop. Please try again.'); }
    finally { setBusy(false); }
  }
  async function upload(file: File | undefined) { if (!file || !activeOrder.internalId) return; const form = new FormData(); form.append('file', file); form.append('orderId', activeOrder.internalId); form.append('kind', action.kind); try { const response = await fetch('/api/photos', { method: 'POST', body: form }); const body = await response.json(); notify(response.ok ? 'Photo attached to this stop.' : body.error || 'Photo upload failed.'); } catch { notify('Photo upload failed. Please try again.'); } }

  return <><div className="page-heading"><div><div className="eyebrow">Driver workspace</div><h1>Today’s route</h1><p>{activeStops.length} active {activeStops.length === 1 ? 'stop' : 'stops'} assigned. One primary action completes each stop.</p></div><span className="status status-teal">{activeStops.length} active</span></div><div className="driver-workspace"><aside className="driver-stop-list panel"><div className="panel-heading"><div><h2>Stops</h2><p>Select a stop to complete its next task.</p></div></div><div className="driver-stop-items">{activeStops.map((order, index) => <button className={`driver-stop ${order.id === activeOrder.id ? 'selected' : ''}`} key={order.id} onClick={() => setSelectedId(order.id)}><span className="route-index">{index + 1}</span><span><strong>{order.customer}</strong><small>{order.address}</small><em>{stages[order.status].label}</em></span><ChevronRight size={16}/></button>)}</div></aside><section className="driver-task panel"><div className="driver-task-header"><span className="route-index"><MapPin size={15}/></span><div><div className="eyebrow">Next task</div><h2>{action.label}</h2><p>{activeOrder.customer} · {activeOrder.address}</p></div></div><div className="driver-task-summary"><div><span>Order</span><strong>{activeOrder.id}</strong></div><div><span>Expected quantity</span><strong>{activeOrder.bags} bags</strong></div><div><span>Instructions</span><strong>{activeOrder.notes || 'No special instructions'}</strong></div></div><div className="panel-body form-grid">{action.handoff && <div className="form-field"><label>Actual bag count</label><input className="form-control" type="number" min="0" inputMode="numeric" value={count === '' ? activeOrder.bags : count} onWheel={(event) => event.currentTarget.blur()} onChange={(event) => setCount(event.target.value)}/></div>}<div className={action.handoff ? 'form-field' : 'form-field full'}><label>Photo evidence <span className="optional">optional unless there is an issue</span></label><label className="photo-input"><Camera size={15}/>Add photo<input type="file" accept="image/*" capture="environment" onChange={(event) => void upload(event.target.files?.[0])}/></label></div><div className="form-field full"><label>Issue or handoff note</label><textarea className="form-control" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Only add a note when operations needs to know something."/></div><div className="form-field full"><Button size="lg" onClick={() => void confirm()} disabled={busy}><PackageCheck size={16}/>{busy ? 'Saving stop…' : action.label}</Button>{action.handoff && <small className="driver-auto-checkin">Arrival is logged automatically when you complete this stop.</small>}</div></div></section></div></>;
}
