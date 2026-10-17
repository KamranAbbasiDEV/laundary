'use client';

import { useState } from 'react';
import { Check, ClipboardCheck, PackageCheck, Play, Timer } from 'lucide-react';
import ProcessorOffersPanel from './processor-offers-panel';
import { Button } from './ui/button';
import type { Order, OrderStatus } from '@/lib/types';

type Props = {
  orders: Order[];
  notify: (message: string) => void;
  onStatusChange: (id: string, status: OrderStatus, note?: string) => Promise<void>;
};

const actionFor = (status: OrderStatus): { label: string; next: OrderStatus; note: string; icon: typeof Check } | null => {
  if (status === 'At processor') return { label: 'Confirm intake', next: 'Processing', note: 'Processor intake confirmed', icon: ClipboardCheck };
  if (status === 'Processing') return { label: 'Pass QC and mark ready', next: 'Ready for pickup', note: 'Processing complete and QC passed', icon: PackageCheck };
  return null;
};

export default function ProcessorWorkspace({ orders, notify, onStatusChange }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const queue = orders.filter(order => ['At processor', 'Processing', 'Ready for pickup'].includes(order.status));
  const active = queue.filter(order => order.status !== 'Ready for pickup');
  const ready = queue.filter(order => order.status === 'Ready for pickup');
  async function advance(order: Order) {
    const action = actionFor(order.status);
    if (!action) return;
    setBusyId(order.id);
    try { await onStatusChange(order.id, action.next, action.note); }
    finally { setBusyId(null); }
  }
  return <>
    <div className="page-heading"><div><div className="eyebrow">Processor workspace</div><h1>Today's production</h1><p>Accept capacity offers, record intake, then release completed work for dispatch pickup.</p></div><span className="status status-amber">{active.length} to work</span></div>
    <ProcessorOffersPanel notify={notify} />
    <section className="panel"><div className="panel-heading"><div><h2>Production queue</h2><p>Work moves forward from intake to ready for pickup. Dispatch schedules every vehicle movement.</p></div><span className="status status-teal">{queue.length} active</span></div><div className="table-wrap"><table><thead><tr><th>Order</th><th>Service</th><th>Quantity</th><th>Current stage</th><th>Next action</th></tr></thead><tbody>{queue.map(order => { const action = actionFor(order.status); const Icon = action?.icon ?? Timer; return <tr key={order.id}><td><strong>{order.id}</strong><div className="customer-location">{order.customer}</div></td><td>{order.service}<div className="customer-location">Due {order.due || 'not set'}</div></td><td>{order.bags} bags</td><td><span className={`status ${order.status === 'Ready for pickup' ? 'status-green' : 'status-amber'}`}>{order.status}</span></td><td>{action ? <Button size="sm" onClick={() => void advance(order)} disabled={busyId === order.id}><Icon size={14} />{busyId === order.id ? 'Updating...' : action.label}</Button> : <span className="customer-location"><Check size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />Awaiting dispatch pickup route</span>}</td></tr>; })}</tbody></table>{!queue.length && <div className="empty">No production work is assigned to your facility yet. Review capacity offers above when they arrive.</div>}</div></section>
    {ready.length > 0 && <section className="panel" style={{ marginTop: 18 }}><div className="panel-heading"><div><h2>Ready for dispatch</h2><p>These orders are complete. A dispatcher will include them in a processor-pickup route.</p></div><Play size={17} color="var(--teal)" /></div><div className="panel-body"><div className="route-list">{ready.map(order => <div className="route-row" key={order.id}><div className="route-index"><Check size={14} /></div><div><div className="route-address">{order.id} - {order.customer}</div><div className="route-customer">{order.service} - {order.bags} bags</div></div><span className="status status-green">Ready</span></div>)}</div></div></section>}
  </>;
}
