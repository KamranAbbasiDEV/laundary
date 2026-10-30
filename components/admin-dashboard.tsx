'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronRight, ClipboardList, Map, Package, Plus, Route, Users } from 'lucide-react';
import type { Order, Processor } from '@/lib/types';
import { Button } from './ui/button';
import OverviewMap from './overview-map';

type Props = {
  orders: Order[];
  processors: Processor[];
  onNavigate: (value: string) => void;
  onCreate: () => void;
};

const routeStatuses = ['Capacity confirmed', 'Ready for pickup', 'Out for delivery'];

export default function AdminDashboard({ orders, processors, onNavigate, onCreate }: Props) {
  const [routeSummary, setRouteSummary] = useState({ active: 0, urgent: 0, failed: 0 });
  const open = orders.filter(order => !order.archived && !['Delivered', 'Processor reviewed'].includes(order.status));
  const intake = open.filter(order => order.requiresValidation || order.status === 'Created');
  const processorDecisions = open.filter(order => ['Validated', 'Processor ranked'].includes(order.status));
  const routeReady = open.filter(order => routeStatuses.includes(order.status) && !order.routeAssigned);
  const processing = open.filter(order => ['At processor', 'Processing'].includes(order.status));
  const returnAndDelivery = open.filter(order => ['Ready for pickup', 'Picked up from processor', 'QC / Reconciliation', 'Out for delivery'].includes(order.status));
  const exceptions = open.filter(order => Boolean(order.exception) || order.failedStop);
  const deadlineRisk = open.filter(order => ['overdue', 'at_risk', 'due_today'].includes(order.deadlineStatus ?? ''));

  const unique = (items: Order[]) => Array.from(new globalThis.Map(items.map(order => [order.id, order])).values());
  const priority = (order: Order) => order.deadlineStatus === 'overdue' ? 0 : order.failedStop ? 1 : order.exception ? 2 : order.deadlineStatus === 'at_risk' ? 3 : order.requiresValidation ? 4 : routeStatuses.includes(order.status) && !order.routeAssigned ? 5 : 6;
  const deadlineTime = (order: Order) => {
    const value = order.deadline ? new Date(order.deadline).getTime() : Number.POSITIVE_INFINITY;
    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
  };
  const actionItems = unique([...deadlineRisk, ...exceptions, ...intake, ...routeReady, ...processorDecisions])
    .sort((a, b) => priority(a) - priority(b) || deadlineTime(a) - deadlineTime(b));

  const activeProcessors = processors.filter(processor => processor.active);
  const capacityLimit = activeProcessors.reduce((total, processor) => total + Math.max(0, processor.capacityLimit), 0);
  const capacityUsed = activeProcessors.reduce((total, processor) => total + Math.max(0, processor.capacityUsed), 0);
  const utilization = capacityLimit ? Math.round((capacityUsed / capacityLimit) * 100) : 0;
  const constrainedProcessors = activeProcessors.filter(processor => processor.capacityLimit > 0 && processor.capacityUsed / processor.capacityLimit >= 0.85);
  const averageScore = activeProcessors.length ? (activeProcessors.reduce((total, processor) => total + processor.score, 0) / activeProcessors.length).toFixed(1) : '—';

  const cards: Array<{ label: string; value: number; foot: string; destination: string; icon: typeof ClipboardList }> = [
    { label: 'Open orders', value: open.length, foot: 'Across the operation', destination: 'Orders', icon: ClipboardList },
    { label: 'Needs action', value: actionItems.length, foot: deadlineRisk.length ? `${deadlineRisk.length} deadline risks` : 'Prioritised decisions', destination: 'Dispatch', icon: AlertTriangle },
    { label: 'Ready for route', value: routeReady.length, foot: 'Not yet scheduled', destination: 'Routes', icon: Route },
    { label: 'Open exceptions', value: exceptions.length, foot: routeSummary.failed ? `${routeSummary.failed} failed route stops` : 'Operational blockers', destination: 'Dispatch', icon: AlertTriangle }
  ];

  const workflow = [
    { label: 'Intake review', value: intake.length, copy: 'Validate new requests', destination: 'Dispatch' },
    { label: 'Processor decision', value: processorDecisions.length, copy: 'Match or confirm capacity', destination: 'Dispatch' },
    { label: 'Route planning', value: routeReady.length, copy: 'Schedule pending movement', destination: 'Routes' },
    { label: 'At processor', value: processing.length, copy: 'Facility work in progress', destination: 'Orders' },
    { label: 'Return & delivery', value: returnAndDelivery.length, copy: 'Reconcile and complete', destination: 'Orders' }
  ];

  const actionLabel = (order: Order) => order.deadlineStatus === 'overdue'
    ? 'Confirm delay and notify customer'
    : order.customerNotificationPending
      ? 'Send customer update'
      : order.failedStop
        ? 'Recover failed route'
        : order.exception
          ? 'Review exception'
          : routeStatuses.includes(order.status) && !order.routeAssigned
            ? order.routeDrafted ? 'Continue draft route' : 'Plan route'
            : order.requiresValidation || order.status === 'Created'
              ? 'Review intake'
              : order.status === 'Processor ranked'
                ? 'Review processor response'
                : 'Review order';

  function openOrder(order: Order) {
    const focus = order.internalId ?? order.id;
    if (routeStatuses.includes(order.status) && !order.routeAssigned) {
      window.localStorage.setItem('rinseline:route-focus', JSON.stringify({ orderId: focus, routeType: order.status === 'Ready for pickup' ? 'processor_pickup' : order.status === 'Out for delivery' ? 'delivery' : 'pickup' }));
      onNavigate('Routes');
      return;
    }
    if (order.exception || order.failedStop || order.requiresValidation || ['Created', 'Processor ranked'].includes(order.status)) {
      window.localStorage.setItem('rinseline:dispatch-focus', focus);
      onNavigate('Dispatch');
      return;
    }
    window.localStorage.setItem('rinseline:global-order-focus', focus);
    onNavigate('Orders');
  }

  return <div className="role-workspace admin-dashboard">
    <div className="page-heading role-page-heading">
      <div><div className="eyebrow">Super Admin · live operations</div><h1>Operations dashboard</h1><p>See what is blocked, where capacity is tightening, and which decision should happen next.</p></div>
      <Button onClick={onCreate}><Plus size={15}/>New order</Button>
    </div>

    <section className="kpis compact-kpis">{cards.map(card => {
      const Icon = card.icon;
      return <button className="kpi dashboard-kpi" key={card.label} onClick={() => onNavigate(card.destination)}><div className="kpi-top"><span>{card.label}</span><span className="kpi-icon"><Icon size={16}/></span></div><div className="kpi-value">{card.value}</div><div className="kpi-foot">{card.foot}</div></button>;
    })}</section>

    <div className="admin-dashboard-grid">
      <section className="panel overview-priority-panel">
        <div className="panel-heading"><div><div className="eyebrow">Priority queue</div><h2>Next decisions</h2><p>Deadline risk and operational blockers are shown first.</p></div><Button variant="ghost" size="sm" onClick={() => onNavigate('Dispatch')}>Open dispatch <ChevronRight size={14}/></Button></div>
        <div className="focus-queue-list">{actionItems.slice(0, 7).map(order => <button className="focus-queue-row" key={order.id} onClick={() => openOrder(order)}><span className="focus-queue-order"><strong>{order.id}</strong><small>{order.customer} · {order.status}</small></span><span className="focus-queue-context"><small>{order.deadlineDelta ?? 'No deadline'}</small><strong>{actionLabel(order)}</strong></span><ChevronRight size={15}/></button>)}{!actionItems.length && <div className="empty compact-empty">Nothing needs an immediate decision.</div>}</div>
      </section>

      <div className="admin-dashboard-side">
        <section className="panel admin-network-panel">
          <div className="panel-heading"><div><div className="eyebrow">Network health</div><h2>Processor capacity</h2><p>Current approved facility coverage.</p></div><Package size={17}/></div>
          <div className="admin-network-stats"><div><span>Active</span><strong>{activeProcessors.length}/{processors.length}</strong></div><div><span>Utilization</span><strong>{utilization}%</strong></div><div><span>Near capacity</span><strong>{constrainedProcessors.length}</strong></div><div><span>Avg. score</span><strong>{averageScore}</strong></div></div>
          <Button variant="outline" size="sm" onClick={() => onNavigate('Processors')}>Manage processors <ChevronRight size={13}/></Button>
        </section>

        <section className="panel admin-control-panel">
          <div className="panel-heading"><div><div className="eyebrow">Administration</div><h2>Control center</h2><p>Access the workspace controls that only you manage.</p></div><Users size={17}/></div>
          <div className="admin-control-links"><button onClick={() => onNavigate('Team')}><span><Users size={15}/>Team and access</span><ChevronRight size={14}/></button><button onClick={() => onNavigate('Reports')}><span><ClipboardList size={15}/>Performance reports</span><ChevronRight size={14}/></button><button onClick={() => onNavigate('Settings')}><span><Package size={15}/>Workspace settings</span><ChevronRight size={14}/></button></div>
        </section>
      </div>
    </div>

    <section className="panel admin-workflow-panel">
      <div className="panel-heading"><div><div className="eyebrow">Workflow load</div><h2>Where orders are now</h2><p>A compact view of the operational flow—not every status at once.</p></div><Button variant="ghost" size="sm" onClick={() => onNavigate('Orders')}>View all orders <ChevronRight size={14}/></Button></div>
      <div className="admin-workflow-grid">{workflow.map(item => <button key={item.label} onClick={() => onNavigate(item.destination)}><span>{item.label}</span><strong>{item.value}</strong><small>{item.copy}</small></button>)}</div>
    </section>

    <details className="panel overview-map-disclosure"><summary><span><Map size={16}/>Live route map</span><small>{routeSummary.active} active · {routeSummary.urgent} urgent · {routeSummary.failed} failed</small></summary><OverviewMap onSummary={setRouteSummary}/></details>
  </div>;
}
