'use client';

import { useMemo, useState } from 'react';
import { Check, MapPin } from 'lucide-react';
import { Button } from './ui/button';
import type { Order, OrderStatus } from '@/lib/types';

const stages: Record<string, { label: string; stage?: 'customer_pickup' | 'processor_dropoff' | 'processor_pickup' | 'customer_delivery'; next: OrderStatus; kind: string }> = {
  'Pickup scheduled': { label: 'Confirm customer pickup', stage: 'customer_pickup', next: 'Picked up', kind: 'customer-pickup' },
  'Picked up': { label: 'Confirm processor drop-off', stage: 'processor_dropoff', next: 'At processor', kind: 'processor-dropoff' },
  'Ready for pickup': { label: 'Confirm processor pickup', stage: 'processor_pickup', next: 'Picked up from processor', kind: 'processor-pickup' },
  'Picked up from processor': { label: 'Complete QC / reconciliation', next: 'QC / Reconciliation', kind: 'qc' },
  'QC / Reconciliation': { label: 'Release for delivery', next: 'Out for delivery', kind: 'qc' },
  'Out for delivery': { label: 'Confirm customer delivery', stage: 'customer_delivery', next: 'Delivered', kind: 'customer-delivery' }
};

export default function DriverWorkflowPanel({ orders, notify, onStatusChange }: { orders: Order[]; notify: (message: string) => void; onStatusChange: (id: string, status: OrderStatus, note?: string) => void }) {
  const current = useMemo(() => orders.find(order => Boolean(stages[order.status])), [orders]);
  const [checkedIn, setCheckedIn] = useState(false);
  const [count, setCount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (!current) return <section className="panel"><div className="panel-body"><div className="empty">No assigned driver stop is ready.</div></div></section>;
  const activeOrder = current;
  const action = stages[activeOrder.status];

  async function checkIn() {
    if (!activeOrder.internalId) { notify('This order is missing its internal identifier'); return; }
    setBusy(true);
    const response = await fetch('/api/route-stops', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: activeOrder.internalId }) });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) { notify(body.error || 'Unable to record arrival'); return; }
    setCheckedIn(true);
    notify(body.alreadyCheckedIn ? 'Arrival was already recorded' : 'Arrival check-in recorded');
  }

  async function confirm() {
    if (!activeOrder.internalId) { notify('This order is missing its internal identifier'); return; }
    setBusy(true);
    if (action.stage) {
      const handoff = await fetch('/api/handoffs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: activeOrder.internalId, stage: action.stage, actualBags: Number(count || activeOrder.bags), discrepancy: note || undefined, notes: note || undefined }) });
      const body = await handoff.json();
      if (!handoff.ok) { setBusy(false); notify(body.error || 'Unable to save handoff'); return; }
    }
    onStatusChange(activeOrder.id, action.next, note || `Recorded count: ${count || activeOrder.bags}`);
    setBusy(false);
    setCheckedIn(false);
    setCount('');
    setNote('');
  }

  async function upload(file: File | undefined) {
    if (!file || !activeOrder.internalId) return;
    const form = new FormData();
    form.append('file', file); form.append('orderId', activeOrder.internalId); form.append('kind', action.kind);
    const response = await fetch('/api/photos', { method: 'POST', body: form });
    const body = await response.json();
    notify(response.ok ? 'Photo attached to handoff' : body.error || 'Photo upload failed');
  }

  return <><div className="page-heading"><div><div className="eyebrow">Assigned route</div><h1>Driver operations</h1><p>Complete each handoff in order. Assigned order access is enforced by the server.</p></div><span className="status status-teal">Stop assigned</span></div><section className="panel"><div className="panel-heading"><div><h2>{activeOrder.id} · {action.label}</h2><p>{activeOrder.customer} · {activeOrder.address}</p></div></div><div className="panel-body form-grid"><div className="form-field"><label>Arrival confirmation</label><Button variant="outline" onClick={() => void checkIn()} disabled={checkedIn || busy}><MapPin size={14} />{checkedIn ? 'Checked in' : busy ? 'Saving…' : 'Check in'}</Button></div><div className="form-field"><label>Bag / item count</label><input className="form-control" type="number" min="0" value={count || activeOrder.bags} onChange={event => setCount(event.target.value)} /></div><div className="form-field full"><label>Photo evidence</label><input className="form-control" type="file" accept="image/*" capture="environment" onChange={event => void upload(event.target.files?.[0])} /></div><div className="form-field full"><label>Discrepancy or handoff note</label><textarea className="form-control" value={note} onChange={event => setNote(event.target.value)} placeholder="Damage, missing, stained, rejected, or other notes" /></div><div className="form-field full" style={{ display: 'flex', justifyContent: 'flex-end' }}><Button onClick={() => void confirm()} disabled={!checkedIn || busy}><Check size={14} />{busy ? 'Saving…' : action.label}</Button></div></div></section></>;
}
