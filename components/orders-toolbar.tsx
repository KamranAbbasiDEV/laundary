'use client';

import { Map } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { OrderStatus, UserRole } from '@/lib/types';
import { statusGroups } from '@/lib/order-statuses';
import { Button } from './ui/button';

type Props = {
  role: UserRole;
  view: 'kanban' | 'table';
  query: string;
  stage: string;
  exact: string;
  records: 'active' | 'archived' | 'all';
  deadlineFilter: 'all' | 'overdue' | 'due_today' | 'due_soon' | 'at_risk';
  attentionFilter: 'all' | 'needs_attention';
  showEmpty: boolean;
  sort: 'created' | 'due' | 'status';
  onViewChange: (view: 'kanban' | 'table') => void;
  onQueryChange: (value: string) => void;
  onStageChange: (value: string) => void;
  onExactChange: (value: string) => void;
  onRecordsChange: (value: 'active' | 'archived' | 'all') => void;
  onDeadlineChange: (value: Props['deadlineFilter']) => void;
  onAttentionChange: (value: Props['attentionFilter']) => void;
  onShowEmptyChange: (value: boolean) => void;
  onSortChange: (value: Props['sort']) => void;
  onNavigate?: (section: string) => void;
};

export default function OrdersToolbar(props: Props) {
  const [open, setOpen] = useState<'stage' | 'filter' | 'sort' | 'attention' | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const isAdmin = props.role === 'super_admin';
  const filterCount = Number(props.deadlineFilter !== 'all') + Number(isAdmin && props.exact !== 'all') + Number(isAdmin && props.records !== 'active');
  const stageLabel = props.stage === 'all' ? 'All stages' : statusGroups.find(group => group.id === props.stage)?.label ?? 'All stages';
  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(null); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(null); };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('mousedown', closeOnOutsideClick); document.removeEventListener('keydown', closeOnEscape); };
  }, [open]);
  return <div ref={rootRef} className={`orders-clean-toolbar orders-list-toolbar ${props.view === 'table' ? 'is-list-toolbar' : 'is-board-toolbar'}`}>
    <div className="orders-clean-toolbar-left">
      <div className="view-toggle" role="group" aria-label="Order view"><button type="button" className={props.view === 'kanban' ? 'active' : ''} aria-label="Kanban view" title="Kanban view" onClick={() => props.onViewChange('kanban')}><img className="client-ui-icon" src="/icons/client/grid-filled-128x128.webp" alt=""/><span className="sr-only">Board</span></button><button type="button" className={props.view === 'table' ? 'active' : ''} aria-label="List view" title="List view" onClick={() => props.onViewChange('table')}><span className="client-list-icon" aria-hidden="true"><i/><i/><i/></span><span className="sr-only">Table</span></button></div>
      <div className="orders-filter-menu orders-stage-menu"><button className={`orders-stage-select ${open === 'stage' ? 'is-open' : ''}`} type="button" aria-haspopup="menu" aria-expanded={open === 'stage'} onClick={() => setOpen(open === 'stage' ? null : 'stage')}><img className="client-ui-icon" src="/icons/client/layers-alt-filled-128x128.webp" alt=""/><span>{stageLabel}</span><img className="orders-stage-chevron" src="/icons/client/chevron-down-filled-128x128-1.webp" alt=""/></button>{open === 'stage' && <div className="orders-toolbar-popover orders-stage-popover" role="menu" aria-label="Filter by stage"><strong>Stage</strong><button type="button" role="menuitemradio" aria-checked={props.stage === 'all'} className={props.stage === 'all' ? 'active' : ''} onClick={() => { props.onStageChange('all'); setOpen(null); }}>All stages</button>{statusGroups.map(group => <button type="button" role="menuitemradio" aria-checked={props.stage === group.id} className={props.stage === group.id ? 'active' : ''} key={group.id} onClick={() => { props.onStageChange(group.id); setOpen(null); }}>{group.label}</button>)}</div>}</div>
      <div className="orders-filter-menu"><button className={`orders-toolbar-button ${filterCount ? 'has-filter' : ''}`} type="button" onClick={() => setOpen(open === 'filter' ? null : 'filter')}><img className="client-ui-icon" src="/icons/client/icon_1icon.png" alt=""/>Filter{filterCount > 0 && <span>{filterCount}</span>}</button>{open === 'filter' && <div className="orders-toolbar-popover"><strong>Filter orders</strong><label><span>Deadline</span><select value={props.deadlineFilter} onChange={event => { props.onDeadlineChange(event.target.value as Props['deadlineFilter']); setOpen(null); }}><option value="all">All deadlines</option><option value="overdue">Overdue</option><option value="due_today">Due today</option><option value="due_soon">Due within 24 hours</option><option value="at_risk">At risk</option></select></label>{isAdmin && <><label><span>Status</span><select value={props.exact} onChange={event => { props.onExactChange(event.target.value); setOpen(null); }}><option value="all">All statuses</option>{statusGroups.flatMap(group => group.statuses).map(status => <option key={status}>{status}</option>)}</select></label><label><span>Records</span><select value={props.records} onChange={event => { props.onRecordsChange(event.target.value as Props['records']); setOpen(null); }}><option value="active">Active only</option><option value="archived">Archived only</option><option value="all">All records</option></select></label></>}</div>}</div>
      <div className="orders-filter-menu"><button className="orders-toolbar-button" type="button" onClick={() => setOpen(open === 'sort' ? null : 'sort')}><img className="client-ui-icon" src="/icons/client/sort-down-filled-128x128-1.webp" alt=""/>Sort</button>{open === 'sort' && <div className="orders-toolbar-popover"><strong>Sort orders</strong><label><span>Order by</span><select value={props.sort} onChange={event => { props.onSortChange(event.target.value as Props['sort']); setOpen(null); }}><option value="created">Newest first</option><option value="due">Due window</option><option value="status">Status</option></select></label></div>}</div>
    </div>
    <div className="orders-clean-toolbar-right">{(props.role === 'super_admin' || props.role === 'dispatcher') && <Button variant="outline" size="sm" type="button" onClick={() => props.onNavigate?.('Routes')}><Map size={14}/>Plan routes</Button>}<label className="orders-search-control"><img className="client-ui-icon" src="/icons/client/search4-filled-128x128-1.webp" alt=""/><span className="sr-only">Search orders</span><input value={props.query} onChange={event => props.onQueryChange(event.target.value)} placeholder="Search orders" /></label></div>
  </div>;
}
