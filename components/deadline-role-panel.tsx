'use client';

import type { Order, UserRole } from '@/lib/types';
import { deadlineStatusLabel, deadlineStatusTone } from '@/lib/deadlines';

function deadlineText(order: Order) {
  if (!order.deadline) return 'No deadline recorded';
  return new Date(order.deadline).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function DeadlineRolePanel({ role, orders }: { role: UserRole; orders: Order[] }) {
  const visible = orders
    .filter((order) => order.deadlineStatus && !['delivered_on_time', 'delivered_late', 'no_deadline'].includes(order.deadlineStatus))
    .sort((a, b) => new Date(a.deadline ?? '9999-12-31').getTime() - new Date(b.deadline ?? '9999-12-31').getTime())
    .slice(0, 8);
  if (!visible.length) return null;
  const title = role === 'driver' ? 'Assigned deadline watch' : role === 'processor' ? 'Facility deadline watch' : 'Delivery deadline watch';
  const copy = role === 'customer' ? 'Your current expected delivery times and customer-safe updates.' : role === 'driver' ? 'Only stops assigned to you are shown.' : role === 'processor' ? 'Only facility work assigned to your processor account is shown.' : 'Orders needing operational attention are shown first.';
  return <section className="panel deadline-role-panel"><div className="panel-heading"><div><h2>{title}</h2><p>{copy}</p></div><span className="status status-amber">{visible.length} need attention</span></div><div className="route-list">{visible.map((order) => <article className="route-row deadline-role-row" key={order.id}><div className="route-index">{order.deadlineStatus === 'overdue' ? '!' : '•'}</div><div><div className="route-address">{order.id} · {role === 'customer' ? 'Your order' : order.customer}</div><div className="route-customer">{deadlineText(order)} · {order.deadlineDelta ?? ''}</div>{role === 'customer' ? <div className="customer-safe-copy">{order.exceptionMessage || (order.deadlineStatus === 'at_risk' || order.deadlineStatus === 'overdue' ? 'This order may be delayed. We will share the next update.' : 'Your order is on track.')}</div> : <div className="route-customer">{order.exception ? `Issue: ${order.exception}` : order.status}</div>}</div><span className={`status status-${deadlineStatusTone[order.deadlineStatus ?? 'no_deadline']}`}>{deadlineStatusLabel[order.deadlineStatus ?? 'no_deadline']}</span></article>)}</div></section>;
}
