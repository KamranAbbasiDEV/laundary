'use client';

import { useState } from 'react';
import { CalendarClock, MapPin, Package, Plus, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import type { Order } from '@/lib/types';
import DeadlineRolePanel from './deadline-role-panel';
import NewOrderModal, { type OrderForm } from './new-order-modal';
import type { ServiceCatalogItem } from '@/lib/service-catalog';

const customerLabel = (status: Order['status']) => ({
  Created: 'Request received', Validated: 'Finding a laundry partner', 'Processor ranked': 'Finding a laundry partner', 'Capacity confirmed': 'Pickup being planned', 'Pickup scheduled': 'Pickup scheduled', 'Picked up': 'With your driver', 'At processor': 'At the laundry facility', Processing: 'Being cleaned', 'Ready for pickup': 'Ready for return route', 'Picked up from processor': 'On the way back', 'QC / Reconciliation': 'Final quality check', 'Out for delivery': 'Out for delivery', Delivered: 'Delivered', 'Processor reviewed': 'Delivered'
} as Record<Order['status'], string>)[status];

const customerDeadline = (order: Order) => order.deadline ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.deadline)) : 'Deadline will be confirmed';

function CustomerOrderRow({ order }: { order: Order }) {
  const delivered = order.status === 'Delivered' || order.status === 'Processor reviewed';
  const deadlineTone = order.deadlineStatus === 'overdue' || order.deadlineStatus === 'at_risk' ? 'customer-order-risk' : order.deadlineStatus === 'delivered_late' ? 'customer-order-late' : '';
  return <article className="customer-order-row"><div className="customer-order-icon"><Package size={17} /></div><div className="customer-order-main"><div className="customer-order-heading"><div><div className="customer-order-service">{order.service}</div><div className="customer-order-number">{order.id}</div></div><span className={`status ${delivered ? 'status-green' : 'status-teal'}`}>{customerLabel(order.status)}</span></div><div className="customer-order-location"><MapPin size={13} />{order.address || 'Pickup address not available'}</div><div className="customer-order-meta"><span><CalendarClock size={13} />{order.pickupWindow || 'Pickup window will be confirmed'}</span><span className={deadlineTone}><CalendarClock size={13} />Expected by {customerDeadline(order)}</span></div>{order.exception && <div className="customer-order-notice">We are reviewing an issue with this order.</div>}</div></article>;
}

function CustomerOrders({ orders, onCreateOrder, notify, onRefresh, services }: { orders: Order[]; onCreateOrder: (data: OrderForm) => Promise<void>; notify: (message: string) => void; onRefresh: () => Promise<void>; services: ServiceCatalogItem[] }) {
  const [showForm, setShowForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  async function refreshOrders() { setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } }
  async function createOrder(data: OrderForm) { await onCreateOrder(data); setShowForm(false); }
  return <><div className="page-heading customer-page-heading"><div><div className="eyebrow">Your laundry service</div><h1>Pickups and orders</h1><p>Request a pickup, then follow each order from collection through delivery.</p></div><Button onClick={() => setShowForm(true)}><Plus size={15} />Request pickup</Button></div><section className="panel customer-orders-panel"><div className="panel-heading"><div><h2>Your orders</h2><p>Track pickup timing, expected delivery, and the latest customer-safe update.</p></div><div className="row-actions"><span className="status status-teal">{orders.length} {orders.length === 1 ? 'order' : 'orders'}</span><Button variant="outline" size="sm" onClick={() => void refreshOrders()} disabled={refreshing}><RefreshCw className={refreshing ? 'spin' : ''} size={14} />{refreshing ? 'Refreshing' : 'Refresh'}</Button></div></div><div className="customer-order-list">{orders.map(order => <CustomerOrderRow key={order.id} order={order} />)}{!orders.length && <div className="empty customer-empty-state"><Package size={20} /><strong>No active orders yet</strong><span>Request a pickup to start your next laundry order.</span><Button size="sm" onClick={() => setShowForm(true)}><Plus size={14} />Request pickup</Button></div>}</div></section>{showForm && <NewOrderModal onClose={() => setShowForm(false)} onCreate={createOrder} services={services} title="Request a pickup" description="Enter your pickup details and we will begin matching your order." submitLabel="Submit pickup request" />}</>;
}

export default function CustomerWorkspace(props: { orders: Order[]; onCreateOrder: (data: OrderForm) => Promise<void>; notify: (message: string) => void; onRefresh: () => Promise<void>; services: ServiceCatalogItem[] }) {
  return <><DeadlineRolePanel role="customer" orders={props.orders} /><CustomerOrders {...props} /></>;
}
