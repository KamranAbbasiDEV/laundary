'use client';

import { useState, type CSSProperties } from 'react';
import type { Order, OrderStatus } from '@/lib/types';
import { statusGroups, statusToneClass } from '@/lib/order-statuses';
import DeadlineBadge from './deadline-badge';

type Props = {
  orders: Order[];
  onInspect: (order: Order) => void;
  canMove: boolean;
  showEmpty: boolean;
  onMove: (orders: Order[], status: OrderStatus) => void;
};

export default function OrdersKanban({ orders, onInspect, canMove, showEmpty, onMove }: Props) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const visibleGroups = statusGroups.filter(group => showEmpty || orders.some(order => group.statuses.includes(order.status)));
  const compactLayout = visibleGroups.length <= 3;

  return <div className={`orders-kanban ${compactLayout ? 'is-compact' : ''}`} aria-label="Orders board" style={{ '--kanban-columns': visibleGroups.length } as CSSProperties}>
    {visibleGroups.map(group => {
      const items = orders.filter(order => group.statuses.includes(order.status));
      return <section className="kanban-column" key={group.id}>
        <header className="kanban-column-header"><div><span className="kanban-stage-mark">##</span><span><small>{group.statuses.join(' → ')}</small>{group.label}</span><strong>{items.length}</strong></div></header>
        <div className={`kanban-column-body ${draggedId ? 'is-drop-target' : ''}`} onDragOver={event => { if (canMove) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }} onDrop={event => { event.preventDefault(); const sourceId = event.dataTransfer.getData('text/plain') || draggedId || ''; const order = orders.find(item => (item.internalId ?? item.id) === sourceId); if (order && canMove && !group.statuses.includes(order.status)) onMove([order], group.statuses[0]); setDraggedId(null); }}>
          {items.length ? items.map(order => {
            const key = order.internalId ?? order.id;
            const isExpanded = expandedIds.has(key);
            const requirementRows = [
              { label: order.service, detail: order.notes?.trim() || 'Standard handling', count: order.bags },
              ...(order.items?.trim() && order.items.trim().toLowerCase() !== order.service.trim().toLowerCase() ? [{ label: 'Items', detail: order.items.trim(), count: order.actualBags ?? order.bags }] : [])
            ].slice(0, 3);
            return <article className={`order-card ${isExpanded ? 'is-expanded' : ''} ${order.exception ? 'has-attention' : ''}`} data-tone={statusToneClass(order.status).replace('status-', '')} data-deadline={order.deadlineStatus ?? 'no_deadline'} key={key} draggable={canMove} onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', key); event.dataTransfer.setData('application/x-rinseline-orders', JSON.stringify([key])); setDraggedId(key); }} onDragEnd={() => setDraggedId(null)}>
              <div className="order-card-reference-head">
                <div className="order-card-reference-title"><strong className="order-card-customer-line"><span>{order.customer}</span>{order.deadlineStatus && order.deadlineStatus !== 'no_deadline' && <DeadlineBadge order={order}/>}</strong><span><button type="button" onClick={() => onInspect(order)}>{order.id}</button><i/><span>{order.bags} bag{order.bags === 1 ? '' : 's'}</span><span>{order.service}</span></span></div>
                <div className="order-card-reference-controls">{order.exception && <span className="order-card-alert" title="Needs attention"><img src="/icons/client/alert-triangle2-filled-48x48-1.webp" alt=""/></span>}<button className={`order-card-expand ${isExpanded ? 'is-expanded' : ''}`} type="button" aria-label={`${isExpanded ? 'Collapse' : 'Expand'} services for ${order.id}`} aria-expanded={isExpanded} onClick={() => setExpandedIds(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; })}><img src="/icons/client/chevron-down-filled-128x128-1.webp" alt=""/></button></div>
              </div>
              <div className="order-card-reference-list">
                {requirementRows.map((row, index) => <div key={`${key}-requirement-${index}`}><span><strong>{row.label}</strong><small>{row.detail}</small></span><em><img src="/icons/client/bag2-filled-48x48-1.webp" alt=""/>{row.count}</em></div>)}
              </div>
              <div className="order-card-reference-footer"><div className="order-card-badges"><span className={`status-pill ${statusToneClass(order.status)}`}>{order.status}</span></div><button className="order-card-action" type="button" title="View details" aria-label={`View details for ${order.id}`} onClick={() => onInspect(order)}><img src="/icons/client/eye-open-filled-128x128-1.webp" alt=""/></button></div>
            </article>;
          }) : <div className="kanban-empty">No orders in this stage</div>}
        </div>
      </section>;
    })}
  </div>;
}
