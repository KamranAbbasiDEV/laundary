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

function LegacyCustomerWorkspace({ orders, onCreateOrder, notify, onRefresh, services }: { orders: Order[]; onCreateOrder: (data: OrderForm) => Promise<void>; notify: (message: string) => void; onRefresh: () => Promise<void>; services: ServiceCatalogItem[] }) {
  const [showForm, setShowForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  async function refreshOrders() { setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } }
  async function createOrder(data: OrderForm) { await onCreateOrder(data); setShowForm(false); }
  return <>
    <div className="page-heading"><div><div className="eyebrow">Your laundry service</div><h1>Pickups and orders</h1><p>Request a pickup, then follow each order from collection through delivery.</p></div><Button onClick={() => setShowForm(true)}><Plus size={15} />Request pickup</Button></div>
    <section className="panel"><div className="panel-heading"><div><h2>Your orders</h2><p>Clear customer-friendly updates; dispatch handles the operational steps behind the scenes.</p></div><div className="row-actions"><span className="status status-teal">{orders.length} total</span><Button variant="outline" size="sm" onClick={() => void refreshOrders()} disabled={refreshing}><RefreshCw className={refreshing ? 'spin' : ''} size={14}/>Refresh</Button></div></div><div className="route-list">{orders.map(order => <article className="route-row" key={order.id}><div className="route-index"><Package size={14} /></div><div><div className="route-address">{order.service} <span className="customer-location">- {order.id}</span></div><div className="route-customer"><MapPin size={12} style={{ verticalAlign: '-2px' }} /> {order.address}</div><div className="route-customer"><CalendarClock size={12} style={{ verticalAlign: '-2px' }} /> {order.due || 'Pickup window will be confirmed'}</div></div><div style={{ textAlign: 'right' }}><span className={`status ${order.status === 'Delivered' ? 'status-green' : 'status-teal'}`}>{customerLabel(order.status)}</span>{order.exception && <div className="field-error" style={{ marginTop: 7 }}>We are reviewing an issue with this order.</div>}</div></article>)}{!orders.length && <div className="empty">You have no active orders. Click Request pickup to get started.</div>}</div></section>
    {showForm && <NewOrderModal onClose={() => setShowForm(false)} onCreate={createOrder} services={services} title="Request a pickup" description="Enter your pickup details and we will begin matching your order." submitLabel="Submit pickup request" />}
  </>;
}

export default function CustomerWorkspace(props: { orders: Order[]; onCreateOrder: (data: OrderForm) => Promise<void>; notify: (message: string) => void; onRefresh: () => Promise<void>; services: ServiceCatalogItem[] }) {
  return <><DeadlineRolePanel role="customer" orders={props.orders}/><LegacyCustomerWorkspace {...props}/></>;
}
