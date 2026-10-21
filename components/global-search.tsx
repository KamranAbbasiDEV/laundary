'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Order, UserRole } from '@/lib/types';

const destinationFor = (role: UserRole) => role === 'processor' ? 'Processor portal' : role === 'driver' ? 'Driver app' : role === 'customer' ? 'Customer portal' : 'Orders';

export default function GlobalSearch({ orders, role, onNavigate }: { orders: Order[]; role: UserRole; onNavigate: (section: string) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const results = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return [];
    return orders.filter(order => [order.id, order.customer, order.phone, order.address, order.service, order.items, order.processor, order.status, order.due, order.deadline].join(' ').toLowerCase().includes(value)).slice(0, 8);
  }, [orders, query]);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); (event.target as HTMLElement).blur?.(); } };
    document.addEventListener('mousedown', close); window.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('keydown', escape); };
  }, []);
  const select = (order: Order) => { window.localStorage.setItem('rinseline:global-order-focus', order.internalId ?? order.id); setQuery(''); setOpen(false); onNavigate(destinationFor(role)); };
  return <div className="global-search" ref={root}><Search size={16}/><input aria-label="Global search" placeholder="Search orders, customers, services..." value={query} onFocus={() => setOpen(Boolean(query.trim()))} onChange={event => { setQuery(event.target.value); setOpen(Boolean(event.target.value.trim())); }} />{query && <button className="global-search-clear" type="button" aria-label="Clear search" onClick={() => { setQuery(''); setOpen(false); }}><X size={14}/></button>}{open && <div className="global-search-results" role="listbox">{results.length ? results.map(order => <button className="global-search-result" type="button" key={order.internalId ?? order.id} onClick={() => select(order)}><span><strong>{order.id}</strong><small>{order.customer} · {order.service}</small></span><em>{order.status}</em></button>) : <div className="global-search-empty">No accessible orders match your search.</div>}</div>}</div>;
}
