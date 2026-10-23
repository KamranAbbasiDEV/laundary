'use client';

import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, ShieldOff, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { FormModal } from './ui/form-modal';
import type { Processor } from '@/lib/types';

type Form = { name: string; address: string; serviceArea: string; capabilities: string; pricing: string; capacityLimit: string; operatingHours: string; turnaroundHours: string; phone: string };
const empty: Form = { name: '', address: '', serviceArea: '', capabilities: 'Wash & Fold', pricing: '', capacityLimit: '0', operatingHours: '', turnaroundHours: '0', phone: '' };
const toForm = (processor: Processor): Form => ({ name: processor.name, address: processor.address, serviceArea: processor.location, capabilities: processor.capabilities.join(', '), pricing: processor.pricing, capacityLimit: String(processor.capacityLimit), operatingHours: processor.operatingHours, turnaroundHours: String(Number.parseFloat(processor.turnaround) || 0), phone: processor.phone });

export default function ProcessorManagerPanel({ processors, notify, onRefresh }: { processors: Processor[]; notify: (message: string) => void; onRefresh: () => Promise<void> }) {
  const [query, setQuery] = useState(''); const [editing, setEditing] = useState<string | null>(null); const [form, setForm] = useState<Form>(empty); const [busy, setBusy] = useState(false);
  const visible = useMemo(() => processors.filter(processor => `${processor.name} ${processor.address} ${processor.location} ${processor.capabilities.join(' ')}`.toLowerCase().includes(query.toLowerCase())), [processors, query]);
  const set = (key: keyof Form, value: string) => setForm(current => ({ ...current, [key]: value }));
  const close = () => { setEditing(null); setForm(empty); };
  const openNew = () => { setEditing('new'); setForm(empty); };
  const openEdit = (processor: Processor) => { setEditing(processor.id); setForm(toForm(processor)); };

  async function save() {
    if (!form.name.trim() || !form.address.trim()) return notify('Processor name and full address are required.');
    setBusy(true);
    const payload = { ...form, capabilities: form.capabilities.split(',').map(item => item.trim()).filter(Boolean), capacityLimit: Number(form.capacityLimit), turnaroundHours: Number(form.turnaroundHours) };
    try {
      const response = await fetch('/api/processors', { method: editing === 'new' ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing === 'new' ? payload : { id: editing, ...payload }) });
      const body = await response.json();
      if (!response.ok) return notify(body.error || 'Unable to save processor.');
      close(); await onRefresh(); notify(editing === 'new' ? 'Processor added to the network.' : 'Processor details updated.');
    } catch { notify('Unable to reach the processor service.'); }
    finally { setBusy(false); }
  }

  async function toggle(processor: Processor) {
    setBusy(true);
    try {
      const response = await fetch('/api/processors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: processor.id, active: !processor.active }) });
      const body = await response.json();
      if (!response.ok) return notify(body.error || 'Unable to update processor access.');
      await onRefresh(); notify(processor.active ? 'Processor deactivated. It will not receive new offers.' : 'Processor reactivated.');
    } catch { notify('Unable to reach the processor service.'); }
    finally { setBusy(false); }
  }

  return <>
    <div className="page-heading"><div><div className="eyebrow">Network management</div><h1>Processors</h1><p>Manage facilities, capabilities, capacity, and whether they can receive new work.</p></div><Button onClick={openNew}><Plus size={15} />Add processor</Button></div>
    {editing && <FormModal title={editing === 'new' ? 'Add processor' : 'Edit processor'} description="These details drive matching and route destinations." onClose={close} labelledBy="processor-form-title" footer={<><Button variant="outline" onClick={close} disabled={busy}>Cancel</Button><Button onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : editing === 'new' ? 'Add processor' : 'Save changes'}</Button></>}><div className="modal-body"><div className="form-grid">{([['name', 'Business name'], ['address', 'Full address'], ['serviceArea', 'Service area'], ['capabilities', 'Capabilities (comma separated)'], ['pricing', 'Pricing'], ['capacityLimit', 'Capacity limit'], ['operatingHours', 'Operating hours'], ['turnaroundHours', 'Turnaround hours'], ['phone', 'Phone']] as Array<[keyof Form, string]>).map(([key, label]) => <div className="form-field" key={key}><label>{label}</label><input className="form-control" type={key === 'capacityLimit' || key === 'turnaroundHours' ? 'number' : 'text'} min="0" value={form[key]} onChange={event => set(key, event.target.value)} /></div>)}</div></div></FormModal>}
    <section className="panel"><div className="processors-toolbar"><label className="orders-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search processors, location, capability…" /></label><span>{visible.length} facilities</span></div><div className="table-wrap"><table><thead><tr><th>Processor</th><th>Capabilities</th><th>Capacity</th><th>Turnaround</th><th>Status</th><th></th></tr></thead><tbody>{visible.map(processor => <tr key={processor.id}><td><strong>{processor.name}</strong><div className="customer-location">{processor.address}</div></td><td>{processor.capabilities.join(' · ') || 'Not configured'}</td><td>{processor.capacityUsed}/{processor.capacityLimit || '—'}</td><td>{processor.turnaround || 'Not configured'}</td><td><span className={`status ${processor.active ? 'status-green' : 'status-red'}`}>{processor.active ? 'Active' : 'Inactive'}</span></td><td><div className="row-actions"><Button size="sm" variant="outline" onClick={() => openEdit(processor)}><Pencil size={13} />Edit</Button><Button size="sm" variant={processor.active ? 'destructive' : 'outline'} onClick={() => void toggle(processor)} disabled={busy}>{processor.active ? <><ShieldOff size={13} />Deactivate</> : <><ShieldCheck size={13} />Activate</>}</Button></div></td></tr>)}</tbody></table>{!visible.length && <div className="empty">No processors match this search.</div>}</div></section>
  </>;
}
