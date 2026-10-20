'use client';

import { Archive, ChevronRight, KanbanSquare, List, Map, Plus, RefreshCw, RotateCcw, Save, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Order, OrderStatus, UserRole } from '@/lib/types';
import { statusGroups, statusToneClass } from '@/lib/order-statuses';
import { humanize } from '@/lib/presentation';
import { notifyDataChanged } from '@/lib/live-updates';
import { DateField } from './ui/date-field';
import { Button } from './ui/button';
import OrdersKanban from './orders-kanban';
// RoutePlannerPanel remains on the dedicated Routes page and is intentionally not embedded here.

type Props = { orders: Order[]; role: UserRole; notify: (message: string) => void; onRefresh: () => Promise<void>; onCreate: () => void; onNavigate?: (section: string) => void };
type BulkAction = 'set_status' | 'record_exception' | 'archive' | 'restore';

const admin = (role: UserRole) => role === 'super_admin';
const date = (value?: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

export default function OrdersWorkspace({ orders, role, notify, onRefresh, onCreate, onNavigate }: Props) {
  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('all');
  const [exact, setExact] = useState('all');
  const [records, setRecords] = useState<'active' | 'archived' | 'all'>('active');
  const [sort, setSort] = useState<'created' | 'due' | 'status'>('created');
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [optimisticStatuses, setOptimisticStatuses] = useState<Record<string, OrderStatus>>({});
  const statuses = useMemo(() => statusGroups.flatMap(group => group.statuses), []);
  const displayOrders = useMemo(() => orders.map(order => ({ ...order, status: optimisticStatuses[order.internalId ?? order.id] ?? order.status })), [orders, optimisticStatuses]);
  const filtered = useMemo(() => displayOrders.filter(order => {
    const text = [order.id, order.customer, order.address, order.processor, order.service].join(' ').toLowerCase();
    const grouped = stage === 'all' || statusGroups.some(group => group.id === stage && group.statuses.includes(order.status));
    const visible = records === 'all' || (records === 'archived' ? Boolean(order.archived) : !order.archived);
    return text.includes(query.trim().toLowerCase()) && grouped && (exact === 'all' || order.status === exact) && visible;
  }), [displayOrders, query, stage, exact, records]);
  const sorted = useMemo(() => [...filtered].sort((a, b) => sort === 'status' ? a.status.localeCompare(b.status) : sort === 'due' ? (a.due || 'zzzz').localeCompare(b.due || 'zzzz') : b.created.localeCompare(a.created)), [filtered, sort]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / 25));
  const displayed = sorted.slice((page - 1) * 25, page * 25);
  const opened = displayOrders.find(order => (order.internalId ?? order.id) === openId) ?? null;
  const selectedOrders = displayOrders.filter(order => picked.includes(order.internalId ?? order.id));
  const selection = new Set(picked);
  const allSelectedArchived = selectedOrders.length > 0 && selectedOrders.every(order => order.archived);

  useEffect(() => { setPage(1); }, [query, stage, exact, records, sort]);
  useEffect(() => {
    if (!opened) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpenId(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [opened]);
  const refresh = async (message: string) => { setBusy(true); try { await onRefresh(); setNotice(message); } finally { setBusy(false); } };
  const toggle = (id: string) => setPicked(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const openSelected = () => { if (picked.length === 1) setOpenId(picked[0]); };

  async function bulk(action: BulkAction, status?: OrderStatus) {
    if (picked.length < 2) return;
    setBusy(true);
    try {
      const response = await fetch('/api/orders/bulk', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderIds: picked, action, status, reason: note.trim() || 'Bulk workflow action' }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Bulk update failed.');
      setPicked([]); setNote(''); await refresh(`${body.updated ?? picked.length} orders updated.${body.warning ? ` ${body.warning}` : ''}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Bulk update failed.'); } finally { setBusy(false); }
  }

  async function update(patch: Record<string, unknown>, message: string) {
    if (!opened) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/orders/${opened.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Order update failed.');
      await refresh(`${message}${body.warning ? ` ${body.warning}` : ''}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Order update failed.'); } finally { setBusy(false); }
  }

  async function moveOrders(movingOrders: Order[], status: OrderStatus) {
    const ordersToMove = movingOrders.filter(order => order.status !== status);
    if (!ordersToMove.length || role !== 'super_admin') return;
    setOptimisticStatuses(current => ({ ...current, ...Object.fromEntries(ordersToMove.map(order => [order.internalId ?? order.id, status])) }));
    setBusy(true);
    try {
      const response = ordersToMove.length === 1
        ? await fetch(`/api/orders/${ordersToMove[0].id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
        : await fetch('/api/orders/bulk', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderIds: ordersToMove.map(order => order.internalId).filter((id): id is string => Boolean(id)), action: 'set_status', status, reason: 'Kanban stage drag and drop' }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to move order.');
      setPicked(current => current.filter(id => !ordersToMove.some(order => (order.internalId ?? order.id) === id)));
      await refresh(`${body.updated ?? ordersToMove.length} order${ordersToMove.length === 1 ? '' : 's'} moved to ${status}.${body.warning ? ` ${body.warning}` : ''}`);
      notifyDataChanged();
      setOptimisticStatuses(current => { const next = { ...current }; ordersToMove.forEach(order => { delete next[order.internalId ?? order.id]; }); return next; });
    } catch (error) {
      setOptimisticStatuses(current => { const next = { ...current }; ordersToMove.forEach(order => { delete next[order.internalId ?? order.id]; }); return next; });
      setNotice(error instanceof Error ? error.message : 'Unable to move order.');
    } finally { setBusy(false); }
  }

  async function lifecycle(action: 'archive' | 'restore' | 'delete', confirmation?: string, reason?: string) {
    if (!opened?.internalId) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/orders/${opened.internalId}/lifecycle`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, confirmation, reason: reason || 'Administrative lifecycle action' }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Lifecycle action failed.');
      if (action === 'delete') setOpenId(null);
      await refresh(`Order ${action}d.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Lifecycle action failed.'); } finally { setBusy(false); }
  }

  const canCreateOrders = role === 'super_admin' || role === 'dispatcher';

  return <section className={`orders-workspace ${view === 'kanban' ? 'is-kanban' : 'is-table'}`}>
    <header className="workspace-header"><div><span className="eyebrow">Order operations</span><h1>Orders</h1><p>Search, filter, sort, and inspect the complete order record.</p></div><div className="workspace-actions"><Button variant="outline" type="button" disabled={busy} onClick={() => void refresh('Order list refreshed.')}><RefreshCw className={busy ? 'spin' : ''} size={15} />Refresh</Button>{canCreateOrders && <Button type="button" disabled={busy} onClick={onCreate}><Plus size={16} />New order</Button>}</div></header>
    {notice && <div className="inline-notice" role="status">{notice}</div>}
    <div className="orders-view-toolbar"><div className="orders-view-summary"><strong>{filtered.length}</strong> order{filtered.length === 1 ? '' : 's'} shown <span>·</span> {filtered.filter(order => order.exception).length} needing attention</div><div className="orders-view-actions">{(role === 'super_admin' || role === 'dispatcher') && <Button variant="outline" size="sm" type="button" onClick={() => onNavigate?.('Routes')}><Map size={14}/>Plan routes</Button>}<div className="view-toggle" role="group" aria-label="Order view"><button type="button" className={view === 'kanban' ? 'active' : ''} onClick={() => setView('kanban')}><KanbanSquare size={14}/>Board</button><button type="button" className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}><List size={14}/>Table</button></div></div></div>
    {/* The embedded RoutePlannerPanel was intentionally removed from this render path. Use the dedicated Routes page. */}
    {view === 'kanban' && filtered.length > 0 && <div className="kanban-selection-actions"><button className="text-button" type="button" onClick={() => setPicked(current => current.length === filtered.length ? [] : filtered.map(order => order.internalId ?? order.id))}>{filtered.every(order => selection.has(order.internalId ?? order.id)) ? 'Clear all shown' : 'Select all shown'}</button></div>}
    <div className="orders-board-layout"><OrdersKanban orders={filtered} selected={selection} onToggle={toggle} onInspect={order => setOpenId(order.internalId ?? order.id)} canMove={role === 'super_admin'} onMove={(movingOrders, status) => void moveOrders(movingOrders, status)} /></div>
    {view === 'kanban' && opened && <div className="order-detail-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpenId(null); }}><section className="order-detail-dialog" role="dialog" aria-modal="true" aria-label="Order details"><Drawer order={opened} role={role} busy={busy} statuses={statuses} note={note} setNote={setNote} onClose={() => setOpenId(null)} onUpdate={update} onLifecycle={lifecycle} /></section></div>}
    {opened && (role === 'dispatcher' || role === 'super_admin') && <DeadlineEditor order={opened} busy={busy} onSaved={() => void refresh('Service deadline updated.')} />}
    <div className="order-filters"><label><span>Search</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Order, customer, address…" /></label><label><span>Stage</span><select value={stage} onChange={event => setStage(event.target.value)}><option value="all">All stages</option>{statusGroups.map(group => <option key={group.id} value={group.id}>{group.label}</option>)}</select></label><label><span>Sort</span><select value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="created">Newest first</option><option value="due">Due window</option><option value="status">Status</option></select></label>{admin(role) && <><label><span>Exact status</span><select value={exact} onChange={event => setExact(event.target.value)}><option value="all">All statuses</option>{statuses.map(value => <option key={value} value={value}>{value}</option>)}</select></label><label><span>Records</span><select value={records} onChange={event => setRecords(event.target.value as typeof records)}><option value="active">Active only</option><option value="archived">Archived only</option><option value="all">All records</option></select></label></>}</div>
    {picked.length > 0 && <div className="selection-toolbar"><div className="selection-summary"><strong>{picked.length} selected</strong><button className="text-button" type="button" onClick={() => setPicked([])}>Clear</button></div>{picked.length === 1 ? <button className="button secondary selection-open" type="button" onClick={openSelected}>Open selected order <ChevronRight size={15} /></button> : <div className="bulk-actions"><span>Bulk actions</span>{admin(role) && <><select aria-label="Set status for selected orders" defaultValue="" disabled={busy} onChange={event => { const value = event.target.value as OrderStatus; if (value) void bulk('set_status', value); event.currentTarget.value = ''; }}><option value="">Set status…</option>{statuses.map(value => <option key={value} value={value}>{value}</option>)}</select><button className="button secondary" type="button" disabled={busy} onClick={() => void bulk(allSelectedArchived ? 'restore' : 'archive')}>{allSelectedArchived ? <RotateCcw size={14} /> : <Archive size={14} />}{allSelectedArchived ? 'Restore' : 'Archive'}</button></>}{role === 'processor' && <><button className="button secondary" type="button" disabled={busy} onClick={() => void bulk('set_status', 'Processing')}>Start work</button><button className="button secondary" type="button" disabled={busy} onClick={() => void bulk('set_status', 'Ready for pickup')}>Mark ready</button></>}{role === 'dispatcher' && <><input value={note} onChange={event => setNote(event.target.value)} placeholder="Exception reason" /><button className="button secondary" type="button" disabled={busy || !note.trim()} onClick={() => void bulk('record_exception')}>Flag exception</button></>}</div>}</div>}
    <div className="orders-layout"><div className="orders-table-wrap"><div className="list-summary">{sorted.length} order{sorted.length === 1 ? '' : 's'} shown · page {page} of {pageCount}</div><table className="orders-table"><thead><tr><th><input type="checkbox" aria-label="Select displayed orders" checked={displayed.length > 0 && displayed.every(order => selection.has(order.internalId ?? order.id))} onChange={event => setPicked(event.target.checked ? displayed.map(order => order.internalId ?? order.id) : [])} /></th><th>Order</th><th>Customer</th><th>Stage</th><th>Assigned</th><th /></tr></thead><tbody>{displayed.map(order => { const key = order.internalId ?? order.id; return <tr key={key} className={openId === key ? 'is-active' : ''}><td><input type="checkbox" aria-label={`Select ${order.id}`} checked={selection.has(key)} onChange={() => toggle(key)} /></td><td><strong>{order.id}</strong><small>{order.service}</small></td><td>{order.customer}<small>{order.address || 'Address pending'}</small></td><td><span className={`status-pill ${statusToneClass(order.status)}`}>{order.status}</span>{order.archived && <small>Archived</small>}</td><td>{order.processor || 'Unassigned'}</td><td><button className="text-button" type="button" onClick={() => setOpenId(key)}>Inspect</button></td></tr>; })}</tbody></table>{!sorted.length && <div className="empty-state"><h2>No matching orders</h2><p>Adjust the filters or search to see more work.</p></div>}<div className="table-pagination"><button className="button secondary" type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><button className="button secondary" type="button" disabled={page >= pageCount} onClick={() => setPage(value => value + 1)}>Next</button></div></div><aside className="order-drawer">{opened ? <Drawer order={opened} role={role} busy={busy} statuses={statuses} note={note} setNote={setNote} onClose={() => setOpenId(null)} onUpdate={update} onLifecycle={lifecycle} /> : <div className="drawer-empty"><h2>Inspect an order</h2><p>Select a row to see its complete record.</p></div>}</aside></div>
  </section>;
}

function Evidence({ orderId }: { orderId?: string }) {
  const [data, setData] = useState<any>(null); const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setData(null); setError('');
    if (!orderId) return () => { active = false; };
    void fetch(`/api/orders/${orderId}/detail`, { cache: 'no-store' }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to load order evidence.'); return body; }).then(body => { if (active) setData(body); }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load order evidence.'); });
    return () => { active = false; };
  }, [orderId]);
  if (error) return <section className="drawer-section"><h3>Operational evidence</h3><p>{error}</p></section>;
  if (!data) return <section className="drawer-section"><h3>Operational evidence</h3><p>Loading timeline and handoffs…</p></section>;
  const storedException = data.exceptions?.find((item: any) => item.status !== 'resolved');
  const fallbackException = data.order?.has_exception ? data.events?.find((item: any) => item.note)?.note : undefined;
  const exceptionText = storedException ? `${humanize(storedException.type)}: ${storedException.description} (${humanize(storedException.status)})` : fallbackException || (data.order?.has_exception ? 'Open exception requires attention.' : undefined);
  return <section className="drawer-section"><h3>Operational evidence</h3><div className="detail-stat"><strong>Timeline</strong><span>{data.events?.length ?? 0} events · latest {humanize(data.events?.[0]?.to_status ?? 'none')} ({date(data.events?.[0]?.created_at)})</span></div><div className="detail-stat"><strong>Handoffs</strong><span>{data.handoffs?.length ? data.handoffs.map((item: any) => `${humanize(item.stage)}: ${item.actual_bags} bags`).join(' · ') : 'None recorded'}</span></div><div className="detail-stat"><strong>Evidence</strong><span>{data.photos?.length ?? 0} photos · {data.routeStops?.length ?? 0} route stops</span></div>{data.photos?.length > 0 && <div className="evidence-photos">{data.photos.map((photo: any) => photo.url ? <a href={photo.url} target="_blank" rel="noreferrer" key={photo.id}><img src={photo.url} alt={`${humanize(photo.kind)} evidence`} /><span>{humanize(photo.kind)}</span></a> : <span key={photo.id}>{humanize(photo.kind)}</span>)}</div>}<div className="detail-stat"><strong>Exceptions</strong><span>{exceptionText || 'None recorded'}</span></div><div className="detail-stat"><strong>Processor offers</strong><span>{data.offers?.length ? data.offers.map((item: any) => `#${item.rank} ${humanize(item.status)}`).join(' · ') : 'None recorded'}</span></div></section>;
}

function DeadlineEditor({ order, busy, onSaved }: { order: Order; busy: boolean; onSaved: () => void }) {
  const [value, setValue] = useState(order.deadline ? new Date(order.deadline).toISOString().slice(0, 16) : '');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setValue(order.deadline ? new Date(order.deadline).toISOString().slice(0, 16) : ''); }, [order.id, order.deadline]);
  async function save() {
    if (!value) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/orders/${order.internalId ?? order.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dueAt: new Date(value).toISOString() }) });
      if (!response.ok) throw new Error('Unable to update the service deadline.');
      onSaved();
    } finally { setSaving(false); }
  }
  return <section className="panel" style={{ marginBottom: 18 }}><div className="panel-body" style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}><div className="form-field"><label>Service deadline for {order.id}</label><DateField type="datetime-local" value={value} disabled={busy || saving} onChange={event => setValue(event.target.value)} aria-label={`Service deadline for ${order.id}`} /></div><button className="button primary" type="button" disabled={busy || saving || !value} onClick={() => void save()}><Save size={14} />{saving ? 'Saving…' : 'Save deadline'}</button></div></section>;
}

function Drawer({ order, role, busy, statuses, note, setNote, onClose, onUpdate, onLifecycle }: { order: Order; role: UserRole; busy: boolean; statuses: OrderStatus[]; note: string; setNote: (value: string) => void; onClose: () => void; onUpdate: (patch: Record<string, unknown>, message: string) => Promise<void>; onLifecycle: (action: 'archive' | 'restore' | 'delete', confirmation?: string, reason?: string) => Promise<void> }) {
  const [confirmation, setConfirmation] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<OrderStatus>(order.status);
  useEffect(() => { setStatus(order.status); setConfirmation(''); setReason(''); }, [order.id, order.status]);
  return <div className="drawer-content"><div className="drawer-heading"><div><span className="eyebrow">{order.archived ? 'Archived record' : 'Order detail'}</span><h2>{order.id}</h2></div><button className="icon-button" type="button" aria-label="Close details" onClick={onClose}><X size={17} /></button></div><div className="drawer-status"><span className={`status-pill ${statusToneClass(order.status)}`}>{order.status}</span><span>Created {date(order.created)}</span></div><dl className="order-facts"><div><dt>Customer</dt><dd>{order.customer}</dd></div><div><dt>Address</dt><dd>{order.address || '—'}</dd></div><div><dt>Processor</dt><dd>{order.processor || 'Unassigned'}</dd></div><div><dt>Service</dt><dd>{order.service}</dd></div><div><dt>Quantity</dt><dd>{order.bags} expected · {order.actualBags ?? '—'} picked up · {order.completedBags ?? '—'} completed</dd></div><div><dt>Priority / due</dt><dd>{order.priority} · {order.due || '—'}</dd></div></dl><Evidence orderId={order.internalId}/>{admin(role) && <section className="drawer-section order-management"><div><h3>Manage order</h3><p>Update this record here. Use the bulk toolbar only for multi-order actions.</p></div><label><span>Status</span><select value={status} disabled={busy} onChange={event => setStatus(event.target.value as OrderStatus)}>{statuses.map(value => <option key={value} value={value}>{value}</option>)}</select></label><div className="management-actions"><button className="button primary" type="button" disabled={busy || status === order.status} onClick={() => void onUpdate({ status }, 'Order status updated.')}><Save size={14} />Save status</button>{order.archived ? <button className="button secondary" type="button" disabled={busy} onClick={() => void onLifecycle('restore')}><RotateCcw size={14} />Restore order</button> : <button className="button secondary archive-action" type="button" disabled={busy} onClick={() => void onLifecycle('archive')}><Archive size={14} />Archive order</button>}</div><details className="destructive-details"><summary>Permanent deletion</summary><label><span>Type {order.id}</span><input value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label><label><span>Reason</span><textarea value={reason} onChange={event => setReason(event.target.value)} /></label><button className="button danger" type="button" disabled={busy || confirmation !== order.id || !reason.trim()} onClick={() => void onLifecycle('delete', confirmation, reason)}>Permanently delete</button></details></section>}{(role === 'super_admin' || role === 'dispatcher') && <section className="drawer-section"><h3>{order.exception ? 'Exception handling' : 'Flag an exception'}</h3><textarea value={note} onChange={event => setNote(event.target.value)} placeholder={order.exception ? 'Add resolution notes' : 'Describe what needs attention'} />{order.exception ? <button className="button secondary" type="button" disabled={busy || !note.trim()} onClick={() => void onUpdate({ resolveException: true, note }, 'Exception resolved.')}>Resolve exception</button> : <button className="button secondary" type="button" disabled={busy || !note.trim()} onClick={() => void onUpdate({ exception: note }, 'Exception recorded.')}>Record exception</button>}</section>}</div>;
}
