'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Save } from 'lucide-react';
import { Button } from './ui/button';
import type { Order } from '@/lib/types';

type Payment = { id: string; order_id: string; amount_due: number; amount_paid: number; status: string; method?: string; reference?: string; notes?: string };

export default function PaymentsPanel({ orders, notify }: { orders: Order[]; notify: (message: string) => void }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [orderId, setOrderId] = useState('');
  const [amountDue, setAmountDue] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [status, setStatus] = useState('unpaid');
  const [method, setMethod] = useState('cash');
  const [busy, setBusy] = useState(false);

  useEffect(() => { void fetch('/api/payments').then(response => response.json()).then(body => setPayments(body.payments ?? [])); }, []);

  async function save() {
    if (!orderId) { notify('Select an order first'); return; }
    setBusy(true);
    const response = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, amountDue: Number(amountDue || 0), amountPaid: Number(amountPaid || 0), status, method }) });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) { notify(body.error || 'Unable to save payment'); return; }
    setPayments(current => [body.payment, ...current.filter(item => item.order_id !== body.payment.order_id)]);
    notify('Payment record saved');
  }

  return <>
    <div className="page-heading"><div><div className="eyebrow">Manual payment ledger</div><h1>Payments</h1><p>Record cash and offline payments with an audit trail.</p></div><CreditCard size={22} color="var(--teal)" /></div>
    <section className="panel" style={{ marginBottom: 18 }}><div className="panel-heading"><div><h2>Record payment</h2><p>Only authorized operations users can update payment status.</p></div></div><div className="panel-body form-grid"><div className="form-field"><label>Order</label><select className="form-control" value={orderId} onChange={event => setOrderId(event.target.value)}><option value="">Select order</option>{orders.map(order => <option key={order.id} value={order.id}>{order.id} · {order.customer}</option>)}</select></div><div className="form-field"><label>Amount due</label><input className="form-control" type="number" min="0" step="0.01" value={amountDue} onChange={event => setAmountDue(event.target.value)} /></div><div className="form-field"><label>Amount paid</label><input className="form-control" type="number" min="0" step="0.01" value={amountPaid} onChange={event => setAmountPaid(event.target.value)} /></div><div className="form-field"><label>Status</label><select className="form-control" value={status} onChange={event => setStatus(event.target.value)}>{['unpaid', 'pending', 'partially_paid', 'paid', 'refunded', 'disputed', 'waived'].map(value => <option key={value}>{value}</option>)}</select></div><div className="form-field"><label>Method</label><select className="form-control" value={method} onChange={event => setMethod(event.target.value)}><option>cash</option><option>bank_transfer</option><option>card_machine</option><option>other</option></select></div><div className="form-field" style={{ alignSelf: 'end' }}><Button onClick={() => void save()} disabled={busy}><Save size={14} />{busy ? 'Saving…' : 'Save payment'}</Button></div></div></section>
    <section className="panel"><div className="table-wrap"><table><thead><tr><th>Order</th><th>Due</th><th>Paid</th><th>Status</th><th>Method</th></tr></thead><tbody>{payments.map(payment => <tr key={payment.id}><td>{orders.find(order => order.internalId === payment.order_id)?.id ?? payment.order_id}</td><td>{Number(payment.amount_due).toFixed(2)}</td><td>{Number(payment.amount_paid).toFixed(2)}</td><td>{payment.status}</td><td>{payment.method || '—'}</td></tr>)}</tbody></table>{!payments.length && <div className="empty">No payment records yet.</div>}</div></section>
  </>;
}
