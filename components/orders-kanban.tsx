'use client';

import { CalendarDays, CheckSquare, GripVertical, Square, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import type { Order, OrderStatus } from '@/lib/types';
import { statusGroups, statusToneClass } from '@/lib/order-statuses';
import DeadlineBadge from './deadline-badge';

type Props = { orders: Order[]; selected: Set<string>; onToggle: (id: string) => void; onInspect: (order: Order) => void; canMove: boolean; canSelect: boolean; showEmpty: boolean; onMove: (orders: Order[], status: OrderStatus) => void };

export default function OrdersKanban({ orders, selected, onToggle, onInspect, canMove, canSelect, showEmpty, onMove }: Props) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  return <div className="orders-kanban" aria-label="Orders board">
    {statusGroups.map(group => {
      const items = orders.filter(order => group.statuses.includes(order.status));
      const groupKeys = items.map(order => order.internalId ?? order.id);
      const allSelected = groupKeys.length > 0 && groupKeys.every(key => selected.has(key));
      if (!showEmpty && !items.length) return null;
      return <section className="kanban-column" key={group.id}>
        <header className="kanban-column-header"><div><span>{group.label}</span><strong>{items.length}</strong></div><div className="kanban-column-tools">{canSelect && <button className="kanban-select-button" type="button" disabled={!groupKeys.length} onClick={() => groupKeys.forEach(key => { if (allSelected) { if (selected.has(key)) onToggle(key); } else if (!selected.has(key)) onToggle(key); })}>{allSelected ? 'Clear' : 'Select all'}</button>}<small>{group.statuses.length} stage{group.statuses.length === 1 ? '' : 's'}</small></div></header>
        <div className={`kanban-column-body ${draggedId ? 'is-drop-target' : ''}`} onDragOver={event => { if (canMove) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }} onDrop={event => { event.preventDefault(); const sourceId = event.dataTransfer.getData('text/plain') || draggedId || ''; const payload = event.dataTransfer.getData('application/x-rinseline-orders'); let payloadIds: string[] = []; if (payload) { try { const parsed = JSON.parse(payload); if (Array.isArray(parsed) && parsed.every(value => typeof value === 'string')) payloadIds = parsed; } catch { payloadIds = []; } } const order = orders.find(item => (item.internalId ?? item.id) === sourceId); const sourceGroup = order && statusGroups.find(source => source.statuses.includes(order.status)); if (order && canMove && !group.statuses.includes(order.status)) { const moving = payloadIds.length > 0 ? orders.filter(item => payloadIds.includes(item.internalId ?? item.id)) : selected.has(sourceId) ? orders.filter(item => selected.has(item.internalId ?? item.id) && sourceGroup?.statuses.includes(item.status)) : [order]; onMove(moving.length ? moving : [order], group.statuses[0]); } setDraggedId(null); }}>
          {items.length ? items.map(order => {
            const key = order.internalId ?? order.id;
            const isSelected = selected.has(key);
            return <article className={`order-card ${order.exception ? 'has-attention' : ''} ${isSelected ? 'is-selected' : ''}`} key={key} draggable={canMove} onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', key); const sourceGroup = statusGroups.find(source => source.statuses.includes(order.status)); const dragIds = isSelected && sourceGroup ? orders.filter(item => selected.has(item.internalId ?? item.id) && sourceGroup.statuses.includes(item.status)).map(item => item.internalId ?? item.id) : [key]; event.dataTransfer.setData('application/x-rinseline-orders', JSON.stringify(dragIds)); setDraggedId(key); }} onDragEnd={() => setDraggedId(null)}>
              <div className="order-card-top"><span className="order-card-drag-handle" title={canMove ? 'Drag to another stage' : undefined}><GripVertical size={14}/></span><span className={`status-pill ${statusToneClass(order.status)}`}>{order.status}</span>{canSelect && <button className="order-card-check" type="button" aria-label={`${isSelected ? 'Deselect' : 'Select'} ${order.id}`} onClick={() => onToggle(key)}>{isSelected ? <CheckSquare size={15}/> : <Square size={15}/>}</button>}</div>
              <button className="order-card-title" type="button" onClick={() => onInspect(order)}>{order.id}</button>
              <strong className="order-card-customer">{order.customer}</strong>
              <div className="order-card-meta">{order.service} · {order.bags} bag{order.bags === 1 ? '' : 's'}</div>
              <div className="order-card-meta"><CalendarDays size={12}/> {order.due || 'No due window'}</div>
              <DeadlineBadge order={order}/>
              <div className="order-card-footer"><span>{order.processor || 'Unassigned'}</span>{order.exception && <span className="attention-label"><TriangleAlert size={12}/> Attention</span>}</div>
              <button className="order-card-action" type="button" onClick={() => onInspect(order)}>Open order details</button>
            </article>;
          }) : <div className="kanban-empty">No orders in this stage</div>}
        </div>
      </section>;
    })}
  </div>;
}
