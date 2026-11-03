'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, ClipboardCheck, Inbox, Map, ShieldAlert, Truck } from 'lucide-react';
import { Button } from './ui/button';
import ValidationQueue from './validation-queue';
import ExceptionQueue from './exception-queue';
import type { Order } from '@/lib/types';

type Queue = 'intake' | 'processor' | 'routes' | 'review' | 'exceptions';
type Props = { orders: Order[]; onNavigate?: (section: string) => void; onSelect: (order: Order) => void; notify: (message: string) => void; onRefresh: () => Promise<void>; onOpenMatching: (order: Pick<Order, 'id' | 'internalId'>) => void; onReview: (id: string) => Promise<void> };

export default function DispatchWorkspace({ orders, onNavigate, onSelect, notify, onRefresh, onOpenMatching, onReview }: Props) {
  const [queue, setQueue] = useState<Queue>('intake');
  const awaitingProcessor = useMemo(() => orders.filter(order => ['Validated', 'Processor ranked'].includes(order.status) && !order.requiresValidation), [orders]);
  const readyForRoute = useMemo(() => orders.filter(order => ['Capacity confirmed', 'Ready for pickup', 'Out for delivery'].includes(order.status) && !order.routeAssigned), [orders]);
  const exceptions = useMemo(() => orders.filter(order => Boolean(order.exception)), [orders]);
  const created = useMemo(() => orders.filter(order => order.requiresValidation ?? order.status === 'Created'), [orders]);
  const awaitingReview = useMemo(() => orders.filter(order => order.status === 'Delivered'), [orders]);
  useEffect(() => { const directFocus = window.localStorage.getItem('rinseline:dispatch-focus'); const notificationFocus = window.localStorage.getItem('rinseline:global-order-focus'); const focus = directFocus ?? notificationFocus; if (!focus) return; if (!directFocus && notificationFocus) { window.localStorage.setItem('rinseline:dispatch-focus', notificationFocus); window.localStorage.removeItem('rinseline:global-order-focus'); } const target = orders.find(order => (order.internalId ?? order.id) === focus || order.id === focus); if (target?.exception) setQueue('exceptions'); else if (target?.status === 'Delivered') setQueue('review'); else if (target && ['Validated', 'Processor ranked'].includes(target.status)) setQueue('processor'); else if (target && ['Capacity confirmed', 'Ready for pickup', 'Out for delivery'].includes(target.status)) setQueue('routes'); else setQueue('intake'); }, [orders]);
  const navigate = (section: string) => onNavigate?.(section);
  const openOrder = (order: Order) => { window.localStorage.setItem('rinseline:global-order-focus', order.internalId ?? order.id); onSelect(order); };
  const planOrder = (order: Order) => { const routeType = order.status === 'Ready for pickup' ? 'processor_pickup' : order.status === 'Out for delivery' ? 'delivery' : 'pickup'; window.localStorage.setItem('rinseline:route-focus', JSON.stringify({ orderId: order.internalId ?? order.id, routeType })); navigate('Routes'); };
  const routeLabel = (order: Order) => order.routeDrafted ? 'Continue draft route' : order.status === 'Capacity confirmed' ? 'Add to route / schedule pickup' : order.status === 'Ready for pickup' ? 'Plan processor pickup' : order.status === 'Out for delivery' ? 'Plan customer delivery' : 'Plan route';
  const tabs: Array<{ id: Queue; label: string; helper: string; count: number; icon: typeof Inbox }> = [
    { id: 'intake', label: 'New intake', helper: 'Validate new requests', count: created.length, icon: Inbox },
    { id: 'processor', label: 'Processor decision', helper: 'Choose and monitor offers', count: awaitingProcessor.length, icon: ClipboardCheck },
    { id: 'routes', label: 'Route planning', helper: 'Schedule ready orders', count: readyForRoute.length, icon: Truck },
    { id: 'review', label: 'Delivered review', helper: 'Close completed work', count: awaitingReview.length, icon: CheckCircle2 },
    { id: 'exceptions', label: 'Exceptions', helper: 'Resolve blockers', count: exceptions.length, icon: ShieldAlert }
  ];
  return <div className="role-workspace dispatch-role-workspace">
    <div className="page-heading role-page-heading"><div><div className="eyebrow">Dispatch control</div><h1>What needs attention</h1><p>Choose a queue, make the next decision, then move on. Everything else stays out of the way.</p></div><Button variant="outline" onClick={() => navigate('Routes')}><Map size={15}/>Open route planner</Button></div>
    <nav className="work-queue-tabs" aria-label="Dispatcher queues">{tabs.map(tab => { const Icon = tab.icon; return <button key={tab.id} type="button" className={queue === tab.id ? 'active' : ''} onClick={() => setQueue(tab.id)}><span className="work-queue-icon"><Icon size={17}/></span><span><strong>{tab.label}</strong><small>{tab.helper}</small></span><em>{tab.count}</em></button>; })}</nav>
    <section className="workspace-focus-panel">
      {queue === 'intake' && <ValidationQueue notify={notify} onRefresh={onRefresh} onValidated={onOpenMatching} onCorrect={order => { window.localStorage.setItem('rinseline:global-order-focus', order.internalId); navigate('Orders'); }}/>}
      {queue === 'processor' && <section className="panel focus-panel"><div className="panel-heading"><div><div className="eyebrow">Capacity queue</div><h2>Processor matching and offers</h2><p>Choose the first offer for validated orders, then monitor the four-hour fallback sequence.</p></div><span className="status status-amber">{awaitingProcessor.length} waiting</span></div><div className="focus-queue-list">{awaitingProcessor.length ? awaitingProcessor.map(order => <button className="focus-queue-row" key={order.id} onClick={() => onOpenMatching(order)}><span className="focus-queue-order"><strong>{order.id}</strong><small>{order.customer} · {order.service}</small></span><span className="focus-queue-context"><small>{order.address || 'Address pending'}</small><strong>{order.status === 'Validated' ? 'Choose first processor' : 'Review offer status'}</strong></span><ArrowRight size={16}/></button>) : <div className="empty compact-empty">No processor decisions are waiting.</div>}</div></section>}
      {queue === 'routes' && <section className="panel focus-panel"><div className="panel-heading"><div><div className="eyebrow">Ready to schedule</div><h2>Build the next route</h2><p>Choose an order to open the planner with the correct route type and order already selected.</p></div><Button variant="outline" size="sm" onClick={() => navigate('Routes')}><Map size={14}/>Open full planner</Button></div><div className="focus-queue-list">{readyForRoute.length ? readyForRoute.map(order => <button className="focus-queue-row" key={order.id} onClick={() => planOrder(order)}><span className="focus-queue-order"><strong>{order.id}</strong><small>{order.customer} · {order.service}</small></span><span className="focus-queue-context"><small>{order.address || 'Address pending'}</small><strong>{routeLabel(order)}</strong></span><ArrowRight size={16}/></button>) : <div className="empty compact-empty">No orders are waiting for route planning.</div>}</div></section>}
      {queue === 'review' && <section className="panel focus-panel"><div className="panel-heading"><div><div className="eyebrow">Completion control</div><h2>Delivered orders awaiting review</h2><p>Confirm the completed handoffs and processor outcome before closing the operational record.</p></div><span className="status status-teal">{awaitingReview.length} ready</span></div><div className="focus-queue-list">{awaitingReview.length ? awaitingReview.map(order => <div className="focus-queue-row" key={order.id}><span className="focus-queue-order"><strong>{order.id}</strong><small>{order.customer} · {order.service}</small></span><span className="focus-queue-context"><small>{order.processor}</small><button className="table-action-button" type="button" onClick={() => void onReview(order.internalId ?? order.id)}>Mark processor reviewed</button></span></div>) : <div className="empty compact-empty">No delivered orders are waiting for review.</div>}</div></section>}
      {queue === 'exceptions' && <ExceptionQueue notify={notify}/>}
    </section>
  </div>;
}
