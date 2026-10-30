'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronRight, LoaderCircle, RefreshCw, Save } from 'lucide-react';
import { Button } from './ui/button';
import { notifyDataChanged } from '@/lib/live-updates';
import { humanize } from '@/lib/presentation';

type Impact = 'none' | 'at_risk' | 'delayed';
type Exception = { id: string; order_id?: string; type: string; description: string; status: string; severity: string; deadline_impact?: Impact; deadline_after?: string | null; deadline_reason?: string | null; customer_message?: string | null; resolution_notes?: string | null; orders?: { order_number?: string; customer_name?: string } | null };

export default function ExceptionQueue({ notify }: { notify: (message: string) => void }) {
  const [items, setItems] = useState<Exception[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [impact, setImpact] = useState<Record<string, Impact>>({});
  const [deadlines, setDeadlines] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [notifyCustomer, setNotifyCustomer] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(false);
  const selected = useMemo(() => items.find(item => item.id === selectedId) ?? items[0], [items, selectedId]);
  const load = useCallback(async () => { setLoading(true); try { const response = await fetch('/api/exceptions?status=active', { cache: 'no-store' }); const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to load exceptions.'); setItems(body.exceptions ?? []); } catch (value) { notify(value instanceof Error ? value.message : 'Unable to load exceptions.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); const refresh = () => void load(); window.addEventListener('rinseline:data-changed', refresh); return () => window.removeEventListener('rinseline:data-changed', refresh); }, [load]);
  useEffect(() => { const focus = window.localStorage.getItem('rinseline:dispatch-focus'); if (!focus) return; const target = items.find(item => item.order_id === focus || item.orders?.order_number === focus); if (target) { setSelectedId(target.id); window.localStorage.removeItem('rinseline:dispatch-focus'); } }, [items]);

  async function update(item: Exception, status: 'in_review' | 'resolved') {
    const selectedImpact = impact[item.id] ?? item.deadline_impact ?? 'at_risk';
    const revised = deadlines[item.id];
    if (status === 'resolved' && !notes[item.id]?.trim()) return notify('Add resolution notes before resolving the exception.');
    if (selectedImpact === 'delayed' && (!revised || !reasons[item.id]?.trim())) return notify('A revised deadline and reason are required for a confirmed delay.');
    setBusy(item.id);
    try {
      const response = await fetch('/api/exceptions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, status, resolutionNotes: notes[item.id], deadlineImpact: selectedImpact, revisedDueAt: revised ? new Date(revised).toISOString() : undefined, deadlineReason: reasons[item.id], customerMessage: messages[item.id], notifyCustomer: notifyCustomer[item.id] }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to update exception.');
      notifyDataChanged();
      notify(status === 'resolved' ? 'Exception resolved.' : 'Exception assigned for review.');
      await load();
    } catch (error) { notify(error instanceof Error ? error.message : 'Unable to update exception.'); } finally { setBusy(''); }
  }

  const selectedImpact = selected ? impact[selected.id] ?? selected.deadline_impact ?? 'at_risk' : 'at_risk';
  return <section className="panel focus-panel exception-focus-panel"><div className="panel-heading"><div><div className="eyebrow">Exception desk</div><h2>Resolve operational blockers</h2><p>Work one issue at a time. Customer communication only appears when a delay is confirmed.</p></div><div className="row-actions"><span className="status status-red">{items.length} open</span><Button variant="outline" size="sm" onClick={() => void load()} disabled={Boolean(busy) || loading}><RefreshCw className={loading ? 'spin' : ''} size={14}/></Button></div></div>{items.length && selected ? <div className="exception-review-layout"><div className="exception-list">{items.map(item => <button type="button" key={item.id} className={item.id === selected.id ? 'active' : ''} onClick={() => setSelectedId(item.id)}><span className={`severity-dot severity-${item.severity}`}/><span><strong>{item.orders?.order_number ?? 'Order'} · {humanize(item.type)}</strong><small>{item.orders?.customer_name ?? 'Customer'} · {humanize(item.status)}</small></span><ChevronRight size={15}/></button>)}</div><div className="exception-detail"><div className="exception-detail-heading"><span className="exception-detail-icon"><AlertTriangle size={17}/></span><div><span className="eyebrow">{humanize(selected.severity)} severity</span><h3>{humanize(selected.type)}</h3><p>{selected.description}</p></div></div><div className="exception-form-grid"><label className="form-field wide"><span>Investigation or resolution note</span><textarea className="form-control" value={notes[selected.id] ?? selected.resolution_notes ?? ''} onChange={event => setNotes(current => ({ ...current, [selected.id]: event.target.value }))} placeholder="Record what was checked and how the issue was handled."/></label><label className="form-field"><span>Deadline impact</span><select className="form-control" value={selectedImpact} onChange={event => setImpact(current => ({ ...current, [selected.id]: event.target.value as Impact }))}><option value="none">No deadline impact</option><option value="at_risk">Deadline at risk</option><option value="delayed">Confirmed delay</option></select></label>{selectedImpact === 'delayed' && <><label className="form-field"><span>Revised deadline</span><input className="form-control" type="datetime-local" value={deadlines[selected.id] ?? (selected.deadline_after ? new Date(selected.deadline_after).toISOString().slice(0, 16) : '')} onChange={event => setDeadlines(current => ({ ...current, [selected.id]: event.target.value }))}/></label><label className="form-field wide"><span>Revision reason</span><input className="form-control" value={reasons[selected.id] ?? selected.deadline_reason ?? ''} onChange={event => setReasons(current => ({ ...current, [selected.id]: event.target.value }))} placeholder="Why did the commitment change?"/></label><label className="form-field wide"><span>Customer message</span><textarea className="form-control" value={messages[selected.id] ?? selected.customer_message ?? ''} onChange={event => setMessages(current => ({ ...current, [selected.id]: event.target.value }))} placeholder="Write a short customer-safe update."/></label><label className="check-control wide"><input type="checkbox" checked={notifyCustomer[selected.id] ?? false} onChange={event => setNotifyCustomer(current => ({ ...current, [selected.id]: event.target.checked }))}/><span>Notify customer when this update is saved</span></label></>}</div><div className="exception-actions"><Button variant="outline" onClick={() => void update(selected, 'in_review')} disabled={busy === selected.id}>{busy === selected.id ? <LoaderCircle className="spin" size={14}/> : <Save size={14}/>}Mark in review</Button><Button onClick={() => void update(selected, 'resolved')} disabled={busy === selected.id}>{busy === selected.id ? <LoaderCircle className="spin" size={14}/> : <Check size={14}/>}Resolve exception</Button></div></div></div> : <div className="empty compact-empty">No unresolved exceptions.</div>}</section>;
}
