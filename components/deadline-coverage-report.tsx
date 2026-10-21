'use client';

import type { Order } from '@/lib/types';

export default function DeadlineCoverageReport({ orders }: { orders: Order[] }) {
  const pickupWindows = orders.filter(order => order.pickupWindowStartAt && order.pickupWindowEndAt).length;
  const deadlines = orders.filter(order => order.deadline).length;
  const deliveredOnTime = orders.filter(order => order.deadlineStatus === 'delivered_on_time').length;
  const deliveredLate = orders.filter(order => order.deadlineStatus === 'delivered_late').length;
  const activeRisk = orders.filter(order => order.deadlineStatus === 'at_risk' || order.deadlineStatus === 'overdue').length;
  const revised = orders.filter(order => order.originalDeadline && order.deadline && order.originalDeadline !== order.deadline);

  return <>
    <section className="panel"><div className="panel-heading"><div><h2>Deadline commitment audit</h2><p>Original customer commitments remain visible alongside the current committed deadline.</p></div><span className="status status-amber">{revised.length} revised</span></div>{revised.length ? <div className="ops-queue">{revised.slice(0, 8).map(order => <div className="ops-queue-row" key={order.id}><span><strong>{order.id} · {order.customer}</strong><small>Original: {new Date(order.originalDeadline as string).toLocaleString()}</small><small>Current: {new Date(order.deadline as string).toLocaleString()}{order.deadlineRevisionReason ? ` · ${order.deadlineRevisionReason}` : ''}</small><small>{order.pickupWindow ? `Pickup window: ${order.pickupWindow}` : 'Pickup window not recorded'}</small></span></div>)}</div> : <div className="empty">No revised deadlines in the current order set.</div>}</section>
    <section className="panel"><div className="panel-heading"><div><h2>Delivery timing coverage</h2><p>Reports use the current committed deadline for delivery performance and retain the original deadline for comparison.</p></div></div><div className="kpis report-kpis"><div className="kpi"><div className="kpi-top"><span>Pickup windows recorded</span></div><div className="kpi-value">{pickupWindows}</div><div className="kpi-foot">Of {orders.length} visible orders</div></div><div className="kpi"><div className="kpi-top"><span>Deadlines recorded</span></div><div className="kpi-value">{deadlines}</div><div className="kpi-foot">Original and committed tracking</div></div><div className="kpi"><div className="kpi-top"><span>Delivered on time</span></div><div className="kpi-value">{deliveredOnTime}</div><div className="kpi-foot">Measured against committed deadline</div></div><div className="kpi"><div className="kpi-top"><span>Late / active risk</span></div><div className="kpi-value">{deliveredLate + activeRisk}</div><div className="kpi-foot">Late deliveries and current risk</div></div></div></section>
  </>;
}
