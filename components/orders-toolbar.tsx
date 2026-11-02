'use client';

import { ChevronDown, Map } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { UserRole } from '@/lib/types';
import { statusGroups } from '@/lib/order-statuses';
import { Button } from './ui/button';

type Choice = { value: string; label: string };
type Props = {
  role: UserRole; view: 'kanban' | 'table'; query: string; stage: string; exact: string;
  records: 'active' | 'archived' | 'all'; deadlineFilter: 'all' | 'overdue' | 'due_today' | 'due_soon' | 'at_risk';
  attentionFilter: 'all' | 'needs_attention'; showEmpty: boolean; sort: 'created' | 'due' | 'status';
  onViewChange: (view: 'kanban' | 'table') => void; onQueryChange: (value: string) => void; onStageChange: (value: string) => void;
  onExactChange: (value: string) => void; onRecordsChange: (value: 'active' | 'archived' | 'all') => void;
  onDeadlineChange: (value: Props['deadlineFilter']) => void; onAttentionChange: (value: Props['attentionFilter']) => void;
  onShowEmptyChange: (value: boolean) => void; onSortChange: (value: Props['sort']) => void; onNavigate?: (section: string) => void;
};

function ToolbarChoice({ label, value, options, onChange }: { label: string; value: string; options: Choice[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false); const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find(option => option.value === value)?.label ?? options[0]?.label ?? label;
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return <div ref={rootRef} className="orders-choice"><button type="button" className={`orders-choice-trigger ${open ? 'is-open' : ''}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)}><span>{selected}</span><ChevronDown size={14}/></button>{open && <div className="orders-choice-menu" role="listbox" aria-label={label}>{options.map(option => <button type="button" role="option" aria-selected={option.value === value} className={option.value === value ? 'active' : ''} key={option.value} onClick={() => { onChange(option.value); setOpen(false); }}>{option.label}</button>)}</div>}</div>;
}

export default function OrdersToolbar(props: Props) {
  const [open, setOpen] = useState<'stage' | 'filter' | 'sort' | null>(null); const rootRef = useRef<HTMLDivElement>(null);
  const isAdmin = props.role === 'super_admin';
  const filterCount = Number(props.deadlineFilter !== 'all') + Number(isAdmin && props.exact !== 'all') + Number(isAdmin && props.records !== 'active');
  const stageLabel = props.stage === 'all' ? 'All stages' : statusGroups.find(group => group.id === props.stage)?.label ?? 'All stages';
  const deadlineOptions: Choice[] = [{ value: 'all', label: 'All deadlines' }, { value: 'overdue', label: 'Overdue' }, { value: 'due_today', label: 'Due today' }, { value: 'due_soon', label: 'Due within 24 hours' }, { value: 'at_risk', label: 'At risk' }];
  const statusOptions: Choice[] = [{ value: 'all', label: 'All statuses' }, ...statusGroups.flatMap(group => group.statuses.map(status => ({ value: status, label: status })) )];
  const recordOptions: Choice[] = [{ value: 'active', label: 'Active only' }, { value: 'archived', label: 'Archived only' }, { value: 'all', label: 'All records' }];
  const sortOptions: Choice[] = [{ value: 'created', label: 'Newest first' }, { value: 'due', label: 'Due window' }, { value: 'status', label: 'Status' }];
  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(null); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(null); };
    document.addEventListener('mousedown', closeOnOutsideClick); document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('mousedown', closeOnOutsideClick); document.removeEventListener('keydown', closeOnEscape); };
  }, [open]);
  return <div ref={rootRef} className={`orders-clean-toolbar orders-list-toolbar ${props.view === 'table' ? 'is-list-toolbar' : 'is-board-toolbar'}`}>
    <div className="orders-clean-toolbar-left">
      <div className="view-toggle" role="group" aria-label="Order view"><button type="button" className={props.view === 'kanban' ? 'active' : ''} aria-label="Kanban view" title="Kanban view" onClick={() => props.onViewChange('kanban')}><img className="client-ui-icon" src="/icons/client/grid-filled-128x128.webp" alt=""/><span className="sr-only">Board</span></button><button type="button" className={props.view === 'table' ? 'active' : ''} aria-label="List view" title="List view" onClick={() => props.onViewChange('table')}><span className="client-list-icon" aria-hidden="true"><i/><i/><i/></span><span className="sr-only">Table</span></button></div>
      <div className="orders-filter-menu orders-stage-menu"><button className={`orders-stage-select ${open === 'stage' ? 'is-open' : ''}`} type="button" aria-haspopup="menu" aria-expanded={open === 'stage'} onClick={() => setOpen(open === 'stage' ? null : 'stage')}><img className="client-ui-icon" src="/icons/client/layers-alt-filled-128x128.webp" alt=""/><span>{stageLabel}</span><img className="orders-stage-chevron" src="/icons/client/chevron-down-filled-128x128-1.webp" alt=""/></button>{open === 'stage' && <div className="orders-toolbar-popover orders-stage-popover" role="menu" aria-label="Filter by stage"><strong>Stage</strong><button type="button" role="menuitemradio" aria-checked={props.stage === 'all'} className={props.stage === 'all' ? 'active' : ''} onClick={() => { props.onStageChange('all'); setOpen(null); }}>All stages</button>{statusGroups.map(group => <button type="button" role="menuitemradio" aria-checked={props.stage === group.id} className={props.stage === group.id ? 'active' : ''} key={group.id} onClick={() => { props.onStageChange(group.id); setOpen(null); }}>{group.label}</button>)}</div>}</div>
      <div className="orders-filter-menu"><button className={`orders-toolbar-button ${filterCount ? 'has-filter' : ''} ${open === 'filter' ? 'is-open' : ''}`} type="button" aria-haspopup="menu" aria-expanded={open === 'filter'} onClick={() => setOpen(open === 'filter' ? null : 'filter')}><img className="client-ui-icon" src="/icons/client/icon_1icon.png" alt=""/>Filter{filterCount > 0 && <span>{filterCount}</span>}<ChevronDown className="orders-toolbar-chevron" size={14}/></button>{open === 'filter' && <div className="orders-toolbar-popover orders-filter-popover"><strong>Filter orders</strong><label><span>Deadline</span><ToolbarChoice label="Deadline" value={props.deadlineFilter} options={deadlineOptions} onChange={value => props.onDeadlineChange(value as Props['deadlineFilter'])}/></label>{isAdmin && <><label><span>Status</span><ToolbarChoice label="Status" value={props.exact} options={statusOptions} onChange={props.onExactChange}/></label><label><span>Records</span><ToolbarChoice label="Records" value={props.records} options={recordOptions} onChange={value => props.onRecordsChange(value as Props['records'])}/></label></>}</div>}</div>
      <div className="orders-filter-menu"><button className={`orders-toolbar-button ${open === 'sort' ? 'is-open' : ''}`} type="button" aria-haspopup="menu" aria-expanded={open === 'sort'} onClick={() => setOpen(open === 'sort' ? null : 'sort')}><img className="client-ui-icon" src="/icons/client/sort-down-filled-128x128-1.webp" alt=""/>Sort<ChevronDown className="orders-toolbar-chevron" size={14}/></button>{open === 'sort' && <div className="orders-toolbar-popover orders-sort-popover"><strong>Sort orders</strong><label><span>Order by</span><ToolbarChoice label="Order by" value={props.sort} options={sortOptions} onChange={value => props.onSortChange(value as Props['sort'])}/></label></div>}</div>
    </div>
    <div className="orders-clean-toolbar-right">{(props.role === 'super_admin' || props.role === 'dispatcher') && <Button variant="outline" size="sm" type="button" onClick={() => props.onNavigate?.('Routes')}><Map size={14}/>Plan routes</Button>}<label className="orders-search-control"><img className="client-ui-icon" src="/icons/client/search4-filled-128x128-1.webp" alt=""/><span className="sr-only">Search orders</span><input value={props.query} onChange={event => props.onQueryChange(event.target.value)} placeholder="Search orders" /></label></div>
  </div>;
}
