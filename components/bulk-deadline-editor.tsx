'use client';

import { useEffect, useState } from 'react';
import type { Order } from '@/lib/types';
import { DateField } from './ui/date-field';

const toInput = (value?: string) => value ? new Date(value).toISOString().slice(0, 16) : '';

export default function BulkDeadlineEditor({ selectedOrders, busy, onSaved }: { selectedOrders: Order[]; busy: boolean; onSaved: () => void }) {
  const [originalValue, setOriginalValue] = useState(toInput(selectedOrders[0]?.originalDeadline ?? selectedOrders[0]?.deadline));
  const [committedValue, setCommittedValue] = useState(toInput(selectedOrders[0]?.deadline));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setOriginalValue(toInput(selectedOrders[0]?.originalDeadline ?? selectedOrders[0]?.deadline)); setCommittedValue(toInput(selectedOrders[0]?.deadline)); setReason(''); }, [selectedOrders[0]?.id]);
  async function save() {
    if (!committedValue) return;
    if (originalValue && new Date(committedValue).getTime() < new Date(originalValue).getTime() && !reason.trim()) return window.alert('Add a reason when the committed deadline is earlier than the original commitment.');
    setSaving(true);
    try {
      const response = await fetch('/api/orders/bulk', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderIds: selectedOrders.map((order) => order.internalId).filter((id): id is string => Boolean(id)), action: 'set_deadline', originalDueAt: originalValue ? new Date(originalValue).toISOString() : undefined, dueAt: new Date(committedValue).toISOString(), reason: reason.trim() || undefined }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to update bulk deadlines.');
      onSaved();
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Unable to update bulk deadlines.'); } finally { setSaving(false); }
  }
  return <div className="bulk-deadline-editor"><strong>Update {selectedOrders.length} committed deadlines</strong><DateField type="datetime-local" value={originalValue} disabled onChange={() => undefined} aria-label="Original deadline preserved" /><DateField type="datetime-local" value={committedValue} disabled={busy || saving} onChange={(event) => setCommittedValue(event.target.value)} aria-label="Bulk committed deadline" /><input className="form-control" value={reason} disabled={busy || saving} onChange={(event) => setReason(event.target.value)} placeholder="Reason (optional unless earlier)" /><button className="button secondary" type="button" disabled={busy || saving || !committedValue} onClick={() => void save()}>Save deadlines</button></div>;
}
