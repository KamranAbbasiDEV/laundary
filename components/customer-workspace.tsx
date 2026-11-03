'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarClock, MapPin, Package, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import type { Order } from '@/lib/types';

const customerLabel = (status: Order['status']) => ({
  Created: 'Request received',
  Validated: 'Finding a laundry partner',
  'Processor ranked': 'Finding a laundry partner',
  'Capacity confirmed': 'Pickup being planned',
  'Pickup scheduled': 'Pickup scheduled',
  'Picked up': 'With your driver',
  'At processor': 'At the laundry facility',
  Processing: 'Being cleaned',
  'Ready for pickup': 'Ready for return route',
  'Picked up from processor': 'On the way back',
  'QC / Reconciliation': 'Final quality check',
  'Out for delivery': 'Out for delivery',
  Delivered: 'Delivered',
  'Processor reviewed': 'Delivered'
} as Record<Order['status'], string>)[status];

const customerDeadline = (order: Order) => order.deadline
  ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.deadline))
  : 'Deadline will be confirmed';

function CustomerOrderRow({ order, focused }: { order: Order; focused?: boolean }) {
  const delivered = order.status === 'Delivered' || order.status === 'Processor reviewed';
  const deadlineTone = order.deadlineStatus === 'overdue' || order.deadlineStatus === 'at_risk'
    ? 'customer-order-risk'
    : order.deadlineStatus === 'delivered_late' ? 'customer-order-late' : '';

  return (
    <article id={`customer-order-${order.internalId ?? order.id}`} className={`customer-order-row${focused ? ' is-focused' : ''}`}>
      <div className="customer-order-icon"><Package size={17} /></div>
      <div className="customer-order-main">
        <div className="customer-order-heading">
          <div><div className="customer-order-service">{order.service}</div><div className="customer-order-number">{order.id}</div></div>
          <span className={`status ${delivered ? 'status-green' : 'status-teal'}`}>{customerLabel(order.status)}</span>
        </div>
        <div className="customer-order-location"><MapPin size={13} />{order.address || 'Pickup address not available'}</div>
        <div className="customer-order-meta">
          <span><CalendarClock size={13} />{order.pickupWindow || 'Pickup window will be confirmed'}</span>
          <span className={deadlineTone}><CalendarClock size={13} />Expected by {customerDeadline(order)}</span>
        </div>
        {order.exception && <div className="customer-order-notice">{order.exceptionMessage || 'We are reviewing an issue with this order.'}</div>}
      </div>
    </article>
  );
}

function CustomerOrders({ orders, onRefresh }: { orders: Order[]; onRefresh: () => Promise<void> }) {
  const [refreshing, setRefreshing] = useState(false);
  const [focusedOrderId, setFocusedOrderId] = useState<string | null>(null);
  const historyRef = useRef<HTMLDetailsElement>(null);
  const activeOrders = orders.filter(order => !['Delivered', 'Processor reviewed'].includes(order.status));
  const completedOrders = orders.filter(order => ['Delivered', 'Processor reviewed'].includes(order.status));

  useEffect(() => {
    const focus = window.localStorage.getItem('rinseline:global-order-focus');
    if (!focus) return;
    const order = orders.find(item => item.id === focus || item.internalId === focus);
    if (!order) return;
    const identity = order.internalId ?? order.id;
    setFocusedOrderId(identity);
    if (['Delivered', 'Processor reviewed'].includes(order.status) && historyRef.current) historyRef.current.open = true;
    window.localStorage.removeItem('rinseline:global-order-focus');
    window.setTimeout(() => document.getElementById(`customer-order-${identity}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    const timer = window.setTimeout(() => setFocusedOrderId(null), 5000);
    return () => window.clearTimeout(timer);
  }, [orders]);

  async function refreshOrders() {
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  }

  return <>
    <div className="page-heading customer-page-heading"><div><div className="eyebrow">Your laundry service</div><h1>Your orders</h1><p>See what is happening now. Contact the operations team when you need a new pickup.</p></div></div>
    <section className="panel customer-orders-panel"><div className="panel-heading"><div><h2>Active service</h2><p>The latest customer-safe status for every order currently in progress.</p></div><div className="row-actions"><span className="status status-teal">{activeOrders.length} active</span><Button variant="outline" size="sm" onClick={() => void refreshOrders()} disabled={refreshing}><RefreshCw className={refreshing ? 'spin' : ''} size={14}/></Button></div></div><div className="customer-order-list">{activeOrders.map(order => <CustomerOrderRow key={order.id} order={order} focused={focusedOrderId === (order.internalId ?? order.id)} />)}{!activeOrders.length && <div className="empty customer-empty-state"><Package size={20}/><strong>No active orders</strong><span>Orders linked to this login will appear here.</span></div>}</div></section>
    {completedOrders.length > 0 && <details ref={historyRef} className="panel customer-history-disclosure"><summary><span>Completed orders</span><small>{completedOrders.length} delivered</small></summary><div className="customer-order-list">{completedOrders.map(order => <CustomerOrderRow key={order.id} order={order} focused={focusedOrderId === (order.internalId ?? order.id)} />)}</div></details>}
  </>;
}

export default function CustomerWorkspace(props: { orders: Order[]; onRefresh: () => Promise<void> }) {
  return <CustomerOrders {...props} />;
}
