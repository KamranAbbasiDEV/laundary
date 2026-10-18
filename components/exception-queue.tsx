'use client';

import { useCallback, useEffect, useState } from 'react';
import { LoaderCircle, RefreshCw, Save } from 'lucide-react';
import { Button } from './ui/button';
import { notifyDataChanged } from '@/lib/live-updates';
import { humanize } from '@/lib/presentation';

type Exception = { id: string; type: string; description: string; status: string; severity: string; resolution_notes?: string | null; orders?: { order_number?: string; customer_name?: string } | null };

export default function ExceptionQueue({ notify }: { notify: (message: string) => void }) {
  const [items, setItems] = useState<Exception[]>([]); const [notes, setNotes] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(''); const [loading, setLoading] = useState(false);
  const load = useCallback(async () => { setLoading(true); try { const response = await fetch('/api/exceptions?status=open'); const body = await response.json(); if (response.ok) setItems(body.exceptions ?? []); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); const refresh = () => void load(); window.addEventListener('rinseline:data-changed', refresh); return () => window.removeEventListener('rinseline:data-changed', refresh); }, [load]);
  async function update(item: Exception, status: 'in_review' | 'resolved') {
    if (status === 'resolved' && !notes[item.id]?.trim()) return notify('Add resolution notes before resolving the exception.');
    setBusy(item.id); try { const response = await fetch('/api/exceptions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, status, resolutionNotes: notes[item.id] }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to update exception.'); notifyDataChanged(); notify(status === 'resolved' ? 'Exception resolved.' : 'Exception assigned for review.'); await load(); } catch (error) { notify(error instanceof Error ? error.message : 'Unable to update exception.'); } finally { setBusy(''); }
  }
  return <section className="panel orders-panel"><div className="panel-heading"><div><h2>Exception queue</h2><p>Own, investigate, and resolve operational blockers with an accountable note.</p></div><Button variant="outline" size="sm" onClick={() => void load()} disabled={Boolean(busy) || loading}><RefreshCw className={loading ? 'spin' : ''} size={14}/>Refresh</Button></div><div className="ops-queue">{items.length ? items.map(item => <div className="ops-queue-row" key={item.id}><span><strong>{item.orders?.order_number ?? 'Order'} · {humanize(item.type)}</strong><small>{item.orders?.customer_name ?? 'Customer'} · {item.description}</small><textarea className="form-control" value={notes[item.id] ?? item.resolution_notes ?? ''} onChange={event => setNotes(current => ({ ...current, [item.id]: event.target.value }))} placeholder="Investigation or resolution notes" /></span><span style={{ display: 'flex', gap: 7, alignItems: 'center' }}><Button size="sm" variant="outline" onClick={() => void update(item, 'in_review')} disabled={busy === item.id}>{busy === item.id ? <LoaderCircle className="spin" size={13}/> : <Save size={13}/>}In review</Button><Button size="sm" onClick={() => void update(item, 'resolved')} disabled={busy === item.id}>{busy === item.id && <LoaderCircle className="spin" size={13}/>}Resolve</Button></span></div>) : <div className="empty">No open exceptions.</div>}</div></section>;
}
