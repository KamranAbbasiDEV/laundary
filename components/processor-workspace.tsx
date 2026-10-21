'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ClipboardCheck, PackageCheck, Play, RefreshCw, Timer } from 'lucide-react';
import ProcessorOffersPanel from './processor-offers-panel';
import { Button } from './ui/button';
import ProcessorIssueForm from './processor-issue-form';
import type { Order, OrderStatus } from '@/lib/types';
import { notifyDataChanged } from '@/lib/live-updates';
import DeadlineRolePanel from './deadline-role-panel';

type Props = {
  orders: Order[];
  notify: (message: string) => void;
  onStatusChange: (id: string, status: OrderStatus, note?: string) => Promise<void>;
  onRefresh: () => Promise<void>;
};

const actionFor = (status: OrderStatus) => status === 'At processor'
  ? { label: 'Confirm intake', next: 'Processing' as OrderStatus, icon: ClipboardCheck, note: 'Processor intake confirmed' }
  : status === 'Processing'
    ? { label: 'Pass QC and mark ready', next: 'Ready for pickup' as OrderStatus, icon: PackageCheck, note: 'Processing complete and QC passed' }
    : null;

function LegacyProcessorWorkspace({ orders, notify, onStatusChange, onRefresh }: Props) {
  const queue = useMemo(() => orders.filter(order => ['At processor', 'Processing', 'Ready for pickup'].includes(order.status)), [orders]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const selectedOrder = queue.find(order => order.id === selectedId) ?? queue[0];
  const actionable = queue.filter(order => actionFor(order.status));
  const selectable = queue.filter(order => Boolean(order.internalId));
  const selectedAtProcessor = selected.filter(id => queue.some(order => order.id === id && order.status === 'At processor'));
  const selectedProcessing = selected.filter(id => queue.some(order => order.id === id && order.status === 'Processing'));
  const allSelected = selectable.length > 0 && selectable.every(order => selected.includes(order.id));
  useEffect(() => {
    const focus = window.localStorage.getItem('rinseline:global-order-focus');
    if (!focus) return;
    const target = queue.find(order => (order.internalId ?? order.id) === focus || order.id === focus);
    window.localStorage.removeItem('rinseline:global-order-focus');
    if (!target) return;
    setSelectedId(target.id);
  }, [queue]);

  function toggle(id: string) {
    setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  }

  async function advance(order: Order) {
    const action = actionFor(order.status);
    if (!action) return;
    setBusyId(order.id);
    try {
      await onStatusChange(order.id, action.next, action.note);
      setSelected(current => current.filter(id => id !== order.id));
      notify(action.next === 'Ready for pickup' ? 'Order released to the dispatch pickup queue.' : 'Intake confirmed; production can begin.');
    } finally {
      setBusyId(null);
    }
  }

  async function bulkAdvance(next: 'Processing' | 'Ready for pickup') {
    const ids = selected.filter(id => actionable.some(order => order.id === id && (next === 'Processing' ? order.status === 'At processor' : order.status === 'Processing')));
    if (!ids.length) return notify(next === 'Processing' ? 'Select orders waiting for intake.' : 'Select orders currently in processing.');
    const orderIds = ids.map(id => queue.find(order => order.id === id)?.internalId).filter((id): id is string => Boolean(id));
    if (!orderIds.length) return notify('The selected orders are missing operational identifiers.');
    setBusyId('bulk');
    try {
      const response = await fetch('/api/orders/bulk', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderIds, action: 'set_status', status: next, reason: next === 'Processing' ? 'Bulk intake confirmed by processor' : 'Bulk production completed and QC passed' }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to update selected orders.');
      setSelected([]);
      notifyDataChanged();
      await onRefresh();
      notify(String(body.updated ?? ids.length) + ' orders updated.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to update selected orders.');
    } finally {
      setBusyId(null);
    }
  }

  async function refreshQueue() {
    setRefreshing(true);
    try {
      notifyDataChanged();
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div><div className="eyebrow">Processor workspace</div><h1>Production queue</h1><p>Accept capacity, confirm intake, process to QC, then release completed work.</p></div>
        <div className="row-actions"><span className="status status-amber">{actionable.length} to work</span><Button size="sm" variant="outline" onClick={() => void refreshQueue()} disabled={refreshing || busyId !== null}><RefreshCw className={refreshing ? 'spin' : ''} size={14} />Refresh</Button></div>
      </div>
      <DeadlineRolePanel role="processor" orders={orders} />
      <ProcessorOffersPanel notify={notify} />
      <div className="orders-layout processor-orders-layout">
        <section className="orders-table-wrap panel">
          <div className="panel-heading processor-queue-heading">
            <div><h2>Assigned work</h2><p>Select assigned jobs for a bulk workflow action, or open one for details.</p></div>
            <div className="processor-selection-actions">
              {selected.length > 0 && <span className="processor-selected-count">{selected.length} selected</span>}
              {selectedAtProcessor.length > 0 && <Button size="sm" variant="outline" onClick={() => void bulkAdvance('Processing')} disabled={busyId !== null}><ClipboardCheck size={13} />Confirm intake</Button>}
              {selectedProcessing.length > 0 && <Button size="sm" onClick={() => void bulkAdvance('Ready for pickup')} disabled={busyId !== null}><PackageCheck size={13} />Mark ready</Button>}
            </div>
          </div>
          <div className="processor-assigned-table">
            <div className="processor-assigned-header" role="row"><span><input className="processor-select-all-checkbox" type="checkbox" aria-label="Select all assigned orders" title="Select all assigned orders" checked={allSelected} disabled={!selectable.length || busyId !== null} onChange={event => setSelected(event.target.checked ? selectable.map(order => order.id) : [])} /></span><span>Order / customer</span><span>Service / quantity</span><span>Due</span><span>Status</span><span>Action</span></div>
            {queue.map(order => {
              const action = actionFor(order.status);
              const ActionIcon = action?.icon;
              return <div className={'processor-assigned-row ' + (selectedOrder?.id === order.id ? 'selected' : '')} key={order.id} onClick={() => setSelectedId(order.id)}>
                <input type="checkbox" aria-label={`Select ${order.id}`} checked={selected.includes(order.id)} disabled={busyId !== null || !order.internalId} onChange={() => toggle(order.id)} onClick={event => event.stopPropagation()} />
                <span className="processor-order-summary"><strong>{order.id} · {order.customer}</strong><small>{order.service} · {order.bags} bags · due {order.due || 'not set'}</small></span>
                <span className="processor-cell-secondary">{order.service} · {order.bags} bags</span>
                <span className="processor-cell-secondary">{order.due || 'Not set'}</span>
                <span className={'status ' + (order.status === 'Ready for pickup' ? 'status-green' : 'status-amber')}>{order.status}</span>
                {action && ActionIcon && <Button size="sm" onClick={event => { event.stopPropagation(); void advance(order); }} disabled={busyId !== null}><ActionIcon size={13} />{busyId === order.id ? 'Saving…' : action.label}</Button>}
              </div>;
            })}
            {!queue.length && <div className="empty">No production work is assigned to your facility.</div>}
          </div>
        </section>
        <aside className="order-drawer processor-order-drawer">
          {selectedOrder ? <div className="drawer-content">
            <div className="drawer-heading"><div><span className="eyebrow">Production job</span><h2>{selectedOrder.id}</h2></div><span className="status status-teal">{selectedOrder.status}</span></div>
            <dl className="order-facts"><div><dt>Customer</dt><dd>{selectedOrder.customer}</dd></div><div><dt>Service</dt><dd>{selectedOrder.service}</dd></div><div><dt>Expected quantity</dt><dd>{selectedOrder.bags} bags</dd></div><div><dt>Due</dt><dd>{selectedOrder.due || 'Not set'}</dd></div><div><dt>Items</dt><dd>{selectedOrder.items || 'No item detail supplied'}</dd></div><div><dt>Instructions</dt><dd>{selectedOrder.notes || 'No special instructions'}</dd></div></dl>
            <ProcessorIssueForm orderId={selectedOrder.internalId ?? selectedOrder.id} notify={notify} />
            <section className="drawer-section"><h3>Production checklist</h3><div className="detail-stat"><strong>1. Reconcile intake quantity</strong><span>{selectedOrder.actualBags ?? selectedOrder.bags} bags recorded at pickup</span></div><div className="detail-stat"><strong>2. Complete service requirements</strong><span>Review specifications before QC.</span></div><div className="detail-stat"><strong>3. Release to dispatch</strong><span>Only mark ready after QC passes.</span></div></section>
            {actionFor(selectedOrder.status) ? <Button onClick={() => void advance(selectedOrder)} disabled={busyId === selectedOrder.id}><Play size={14} />{busyId === selectedOrder.id ? 'Saving…' : actionFor(selectedOrder.status)?.label}</Button> : <section className="drawer-section processor-ready-note"><Check size={16} color="var(--green)" /><span>Ready for a dispatcher’s processor-pickup route.</span></section>}
          </div> : <div className="drawer-empty"><Timer size={18} /><p>Select a production job.</p></div>}
        </aside>
      </div>
    </>
  );
}

export default function ProcessorWorkspace(props: Props) {
  return <div className="processor-portal-shell"><LegacyProcessorWorkspace {...props} /></div>;
}
