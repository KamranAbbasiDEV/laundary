'use client';

import { ArrowDownUp, Filter, KanbanSquare, List, Map, Search } from 'lucide-react';
import { useState } from 'react';
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
  sort: 'created' | 'due' | 'status';
  onViewChange: (view: 'kanban' | 'table') => void;
  onQueryChange: (value: string) => void;
  onStageChange: (value: string) => void;
  onExactChange: (value: string) => void;
  onRecordsChange: (value: 'active' | 'archived' | 'all') => void;
  onDeadlineChange: (value: Props['deadlineFilter']) => void;
  onSortChange: (value: Props['sort']) => void;
  onNavigate?: (section: string) => void;
};

export default function OrdersToolbar(props: Props) {
  const [open, setOpen] = useState<'filter' | 'sort' | null>(null);
  const isAdmin = props.role === 'super_admin';
  const filterCount = Number(props.deadlineFilter !== 'all') + Number(isAdmin && props.exact !== 'all') + Number(isAdmin && props.records !== 'active');
  return <div className={`orders-clean-toolbar orders-list-toolbar ${props.view === 'table' ? 'is-list-toolbar' : 'is-board-toolbar'}`}>
    <div className="orders-clean-toolbar-left">
      <div className="view-toggle" role="group" aria-label="Order view"><button type="button" className={props.view === 'kanban' ? 'active' : ''} onClick={() => props.onViewChange('kanban')}><KanbanSquare size={14}/>Board</button><button type="button" className={props.view === 'table' ? 'active' : ''} onClick={() => props.onViewChange('table')}><List size={14}/>Table</button></div>
      <label className="orders-stage-select"><span className="sr-only">Stage</span><select value={props.stage} onChange={event => props.onStageChange(event.target.value)}><option value="all">All stages</option>{statusGroups.map(group => <option key={group.id} value={group.id}>{group.label}</option>)}</select></label>
      <div className="orders-filter-menu"><button className={`orders-toolbar-button ${filterCount ? 'has-filter' : ''}`} type="button" onClick={() => setOpen(open === 'filter' ? null : 'filter')}><Filter size={14}/>Filter{filterCount > 0 && <span>{filterCount}</span>}</button>{open === 'filter' && <div className="orders-toolbar-popover"><strong>Filter orders</strong><label><span>Deadline</span><select value={props.deadlineFilter} onChange={event => props.onDeadlineChange(event.target.value as Props['deadlineFilter'])}><option value="all">All deadlines</option><option value="overdue">Overdue</option><option value="due_today">Due today</option><option value="due_soon">Due within 24 hours</option><option value="at_risk">At risk</option></select></label>{isAdmin && <><label><span>Status</span><select value={props.exact} onChange={event => props.onExactChange(event.target.value)}><option value="all">All statuses</option>{statusGroups.flatMap(group => group.statuses).map(status => <option key={status}>{status}</option>)}</select></label><label><span>Records</span><select value={props.records} onChange={event => props.onRecordsChange(event.target.value as Props['records'])}><option value="active">Active only</option><option value="archived">Archived only</option><option value="all">All records</option></select></label></>}</div>}</div>
      <div className="orders-filter-menu"><button className="orders-toolbar-button" type="button" onClick={() => setOpen(open === 'sort' ? null : 'sort')}><ArrowDownUp size={14}/>Sort</button>{open === 'sort' && <div className="orders-toolbar-popover"><strong>Sort orders</strong><label><span>Order by</span><select value={props.sort} onChange={event => props.onSortChange(event.target.value as Props['sort'])}><option value="created">Newest first</option><option value="due">Due window</option><option value="status">Status</option></select></label></div>}</div>
    </div>
    <div className="orders-clean-toolbar-right">{(props.role === 'super_admin' || props.role === 'dispatcher') && <Button variant="outline" size="sm" type="button" onClick={() => props.onNavigate?.('Routes')}><Map size={14}/>Plan routes</Button>}<label className="orders-search-control"><Search size={15}/><span className="sr-only">Search orders</span><input value={props.query} onChange={event => props.onQueryChange(event.target.value)} placeholder="Search orders" /></label></div>
  </div>;
}
