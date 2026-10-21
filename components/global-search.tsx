'use client';

import { LoaderCircle, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Order, UserRole } from '@/lib/types';

const destinationFor = (role: UserRole) => role === 'processor' ? 'Processor portal' : role === 'driver' ? 'Driver app' : role === 'customer' ? 'Customer portal' : 'Orders';

export default function GlobalSearch({ role, onNavigate }: { role: UserRole; onNavigate: (section: string) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) { setResults([]); setLoading(false); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void fetch(`/api/orders?q=${encodeURIComponent(value)}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Search unavailable.');
        setResults(body.orders ?? []);
      }).catch(error => { if (error?.name !== 'AbortError') setResults([]); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); (event.target as HTMLElement).blur?.(); } };
    document.addEventListener('mousedown', close); window.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('keydown', escape); };
  }, []);

  const select = (order: Order) => { window.localStorage.setItem('rinseline:global-order-focus', order.internalId ?? order.id); setQuery(''); setResults([]); setOpen(false); onNavigate(destinationFor(role)); };
  return <div className="global-search" ref={root}><Search size={16}/><input aria-label="Global search" placeholder="Search orders, customers, services..." value={query} onFocus={() => setOpen(Boolean(query.trim()))} onChange={event => { setQuery(event.target.value); setOpen(Boolean(event.target.value.trim())); }} />{loading ? <LoaderCircle className="spin" size={14}/> : query && <button className="global-search-clear" type="button" aria-label="Clear search" onClick={() => { setQuery(''); setResults([]); setOpen(false); }}><X size={14}/></button>}{open && <div className="global-search-results" role="listbox">{results.length ? results.map(order => <button className="global-search-result" type="button" key={order.internalId ?? order.id} onClick={() => select(order)}><span><strong>{order.id}</strong><small>{order.customer} · {order.service}</small></span><em>{order.status}</em></button>) : <div className="global-search-empty">{query.trim().length < 2 ? 'Type at least 2 characters to search.' : loading ? 'Searching accessible orders…' : 'No accessible orders match your search.'}</div>}</div>}</div>;
}
