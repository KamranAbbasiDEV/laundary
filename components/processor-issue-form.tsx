'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';

export default function ProcessorIssueForm({ orderId, notify }: { orderId: string; notify: (message: string) => void }) {
  const [description, setDescription] = useState(''); const [busy, setBusy] = useState(false);
  async function submit() { if (!description.trim()) return notify('Describe the processing or quality issue first.'); setBusy(true); try { const response = await fetch('/api/exceptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, type: 'quality_issue', stage: 'processing', description: description.trim(), severity: 'medium' }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to report issue.'); setDescription(''); notify('Issue sent to dispatch for resolution.'); } catch (error) { notify(error instanceof Error ? error.message : 'Unable to report issue.'); } finally { setBusy(false); } }
  return <section className="drawer-section"><h3><AlertTriangle size={15}/>Report an issue</h3><textarea className="form-control" value={description} onChange={event => setDescription(event.target.value)} placeholder="Damage, quality concern, missing specification, or quantity discrepancy"/><Button variant="outline" onClick={() => void submit()} disabled={busy || !description.trim()}>{busy ? 'Sending…' : 'Send to dispatch'}</Button></section>;
}
