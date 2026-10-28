'use client';

import { ArrowRight, ClipboardCheck, Map, ShieldAlert, Truck } from 'lucide-react';
import { Button } from './ui/button';
import ValidationQueue from './validation-queue';
import ExceptionQueue from './exception-queue';
import type { Order } from '@/lib/types';

export default function DispatchWorkspace({ orders, onNavigate, onSelect, notify, onRefresh }: { orders: Order[]; onNavigate?: (section: string) => void; onSelect: (order: Order) => void; notify: (message: string) => void; onRefresh: () => Promise<void> }) {
  const awaitingProcessor = orders.filter(order => order.status === 'Processor ranked');
  const readyForPickup = orders.filter(order => order.status === 'Capacity confirmed');
  const exceptions = orders.filter(order => Boolean(order.exception));
  const navigate = (section: string) => {
    if (onNavigate) return onNavigate(section);
    Array.from(document.querySelectorAll<HTMLButtonElement>('.nav-item')).find(button => button.textContent?.trim() === section)?.click();
  };
  const renderOrder = (order: Order) => <button className="ops-queue-row" key={order.id} onClick={() => onSelect(order)}><span><strong>{order.id} · {order.customer}</strong><small>{order.service} · {order.address}</small></span><span className="status status-teal">{order.status}</span></button>;
  return <>
    <div className="page-heading"><div><div className="eyebrow">Dispatch control</div><h1>Today’s work</h1><p>Start with the queues that need a human decision. Order statuses update automatically after the required event.</p></div><Button onClick={() => navigate('Routes')}><Map size={15} />Plan routes</Button></div>
    <ValidationQueue notify={notify} onRefresh={onRefresh}/>
    <div className="dispatch-summary">
      <button className="dispatch-summary-card" onClick={() => navigate('Routes')}><span className="dispatch-summary-icon"><Truck size={17} /></span><span><strong>{readyForPickup.length}</strong><small>ready for pickup planning</small></span><ArrowRight size={16} /></button>
      <button className="dispatch-summary-card" onClick={() => navigate('Processors')}><span className="dispatch-summary-icon amber"><ClipboardCheck size={17} /></span><span><strong>{awaitingProcessor.length}</strong><small>awaiting processor acceptance</small></span><ArrowRight size={16} /></button>
      <button className="dispatch-summary-card" onClick={() => navigate('Orders')}><span className="dispatch-summary-icon red"><ShieldAlert size={17} /></span><span><strong>{exceptions.length}</strong><small>exceptions need review</small></span><ArrowRight size={16} /></button>
    </div>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-heading"><div><h2>Ready to plan pickup</h2><p>These orders have processor capacity confirmed. Select them in Routes to build one pickup route.</p></div><Button variant="outline" size="sm" onClick={() => navigate('Routes')}>Open route planner<ArrowRight size={14} /></Button></div><div className="ops-queue">{readyForPickup.length ? readyForPickup.map(renderOrder) : <div className="empty">No orders are ready to add to a pickup route.</div>}</div></section>
      <section className="panel"><div className="panel-heading"><div><h2>Processor response</h2><p>Offers are waiting on the processor—not another Dispatcher status click.</p></div></div><div className="ops-queue">{awaitingProcessor.length ? awaitingProcessor.map(renderOrder) : <div className="empty">No processor offers are awaiting a response.</div>}</div></section>
    </div>
    <ExceptionQueue notify={notify}/>
    <section className="panel orders-panel"><div className="panel-heading"><div><h2>Exceptions</h2><p>Open an order to review the issue and record its resolution.</p></div></div><div className="ops-queue">{exceptions.length ? exceptions.map(renderOrder) : <div className="empty">No unresolved exceptions.</div>}</div></section>
  </>;
}
