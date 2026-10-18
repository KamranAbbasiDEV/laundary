'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, LoaderCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

type PendingOrder = { id: string; order_number: string; customer_name: string; service_type: string; expected_bags: number; pickup_address: string; due_at_label: string | null; validation_reason: string | null };

export default function ValidationQueue({ notify, onRefresh }: { notify: (message: string) => void; onRefresh: () => Promise<void> }) {
  const [orders, setOrders] = useState<PendingOrder[]>([]); const [busy, setBusy] = useState(''); const [reason, setReason] = useState<Record<string, string>>({}); const [loading, setLoading] = useState(false);
  const load = useCallback(async () => { setLoading(true); try { const response = await fetch('/api/orders/validation'); const body = await response.json(); if (response.ok) setOrders(body.orders ?? []); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); const refresh = () => void load(); window.addEventListener('rinseline:data-changed', refresh); return () => window.removeEventListener('rinseline:data-changed', refresh); }, [load]);
  async function decide(order: PendingOrder, action: 'approve' | 'request_changes') {
    if (action === 'request_changes' && !reason[order.id]?.trim()) return notify('Describe what must be corrected first.');
    setBusy(order.id);
    try {
      const response = await fetch('/api/orders/validation', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: order.id, action, reason: reason[order.id] }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to save the validation decision.');
      notify(action === 'approve' ? (body.matched ? 'Order validated and sent for processor capacity.' : 'Order validated. No eligible processor is configured yet.') : 'Correction request saved for dispatcher follow-up.');
      if (action === 'approve') await onRefresh();
      await load();
    } catch (error) { notify(error instanceof Error ? error.message : 'Unable to save the validation decision.'); } finally { setBusy(''); }
  }
  return <section className="panel orders-panel"><div className="panel-heading"><div><h2>Validation review</h2><p>Customer-submitted orders remain here until a dispatcher confirms the information and starts matching.</p></div><Button variant="outline" size="sm" onClick={() => void load()} disabled={Boolean(busy) || loading}><RefreshCw className={loading ? 'spin' : ''} size={14}/>Refresh</Button></div><div className="ops-queue">{orders.length ? orders.map(order => <div className="ops-queue-row" key={order.id}><span><strong>{order.order_number} · {order.customer_name}</strong><small>{order.service_type} · {order.expected_bags} bags · {order.pickup_address}</small><small>{order.due_at_label || 'Pickup window missing'}</small><input className="form-control" value={reason[order.id] ?? order.validation_reason ?? ''} onChange={event => setReason(current => ({ ...current, [order.id]: event.target.value }))} placeholder="Correction required (only if holding)" /></span><span style={{ display: 'flex', gap: 7, alignItems: 'center' }}><Button size="sm" onClick={() => void decide(order, 'approve')} disabled={busy === order.id}>{busy === order.id ? <LoaderCircle className="spin" size={13}/> : <Check size={13}/>} {busy === order.id ? 'Saving...' : 'Approve'}</Button><Button size="sm" variant="outline" onClick={() => void decide(order, 'request_changes')} disabled={busy === order.id}>{busy === order.id && <LoaderCircle className="spin" size={13}/>}Hold for correction</Button></span></div>) : <div className="empty">No orders need validation.</div>}</div></section>;
}
