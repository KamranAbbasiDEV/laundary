'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Save } from 'lucide-react';
import { Button } from './ui/button';
import type { Order } from '@/lib/types';
import { humanize } from '@/lib/presentation';

type Payment = { id: string; order_id: string; amount_due: number; amount_paid: number; status: string; method?: string; reference?: string; notes?: string };
const paymentStatuses = ['unpaid', 'pending', 'partially_paid', 'paid', 'refunded', 'disputed', 'waived'];
const paymentMethods = ['cash', 'bank_transfer', 'card_machine', 'other'];

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
    if (!orderId) { notify('Choose an order first.'); return; }
    setBusy(true);
    const response = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, amountDue: Number(amountDue || 0), amountPaid: Number(amountPaid || 0), status, method }) });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) { notify(body.error || 'Unable to save payment.'); return; }
    setPayments(current => [body.payment, ...current.filter(item => item.order_id !== body.payment.order_id)]);
    notify('Payment record saved.');
  }

  return <>
    <div className="page-heading"><div><div className="eyebrow">Payment records</div><h1>Payments</h1><p>Record offline payments and keep each order’s payment history clear.</p></div><CreditCard size={22} color="var(--teal)" /></div>
    <section className="panel" style={{ marginBottom: 18 }}><div className="panel-heading"><div><h2>Record a payment</h2><p>Choose an order, enter the amounts, and select how the customer paid.</p></div></div><div className="panel-body form-grid"><div className="form-field"><label>Order</label><select className="form-control" value={orderId} onChange={event => setOrderId(event.target.value)}><option value="">Choose an order</option>{orders.map(order => <option key={order.id} value={order.id}>{order.id} · {order.customer}</option>)}</select></div><div className="form-field"><label>Amount due</label><input className="form-control" type="number" min="0" step="0.01" value={amountDue} onChange={event => setAmountDue(event.target.value)} placeholder="0.00" /></div><div className="form-field"><label>Amount paid</label><input className="form-control" type="number" min="0" step="0.01" value={amountPaid} onChange={event => setAmountPaid(event.target.value)} placeholder="0.00" /></div><div className="form-field"><label>Payment status</label><select className="form-control" value={status} onChange={event => setStatus(event.target.value)}>{paymentStatuses.map(value => <option key={value} value={value}>{humanize(value)}</option>)}</select></div><div className="form-field"><label>Payment method</label><select className="form-control" value={method} onChange={event => setMethod(event.target.value)}>{paymentMethods.map(value => <option key={value} value={value}>{humanize(value)}</option>)}</select></div><div className="form-field form-actions"><Button onClick={() => void save()} disabled={busy}><Save size={14} />{busy ? 'Saving…' : 'Save payment'}</Button></div></div></section>
    <section className="panel"><div className="table-wrap"><table><thead><tr><th>Order</th><th>Amount due</th><th>Amount paid</th><th>Payment status</th><th>Method</th></tr></thead><tbody>{payments.map(payment => <tr key={payment.id}><td>{orders.find(order => order.internalId === payment.order_id)?.id ?? payment.order_id}</td><td>{Number(payment.amount_due).toFixed(2)}</td><td>{Number(payment.amount_paid).toFixed(2)}</td><td>{humanize(payment.status)}</td><td>{payment.method ? humanize(payment.method) : '—'}</td></tr>)}</tbody></table>{!payments.length && <div className="empty">No payment records yet.</div>}</div></section>
  </>;
}
