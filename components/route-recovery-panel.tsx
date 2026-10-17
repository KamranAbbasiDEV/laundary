'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';

type Plan = { id: string; route_date: string; route_type: string; status: string; route_stops: Array<{ id: string; order_id: string; sequence: number; status: string; failure_reason?: string | null }> };

export default function RouteRecoveryPanel({ notify }: { notify: (message: string) => void }) {
  const [plans, setPlans] = useState<Plan[]>([]); const [reopened, setReopened] = useState(''); const [busy, setBusy] = useState('');
  const load = useCallback(async () => { const response = await fetch('/api/route-plans'); const body = await response.json(); if (response.ok) setPlans((body.plans ?? []).filter((plan: Plan) => plan.status === 'failed' || plan.id === reopened)); }, [reopened]);
  useEffect(() => { void load(); }, [load]);
  async function action(plan: Plan, recover: boolean) {
    setBusy(plan.id);
    try {
      const response = await fetch('/api/route-plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(recover ? { action: 'recover', planId: plan.id } : { planId: plan.id }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to update the route.');
      if (recover) { setReopened(plan.id); notify('Failed stops reopened as a draft. Review the stop list, then approve the recovery route.'); } else { setReopened(''); notify('Recovery route approved and reassigned.'); }
      await load();
    } catch (error) { notify(error instanceof Error ? error.message : 'Unable to update the route.'); } finally { setBusy(''); }
  }
  const visible = plans.filter(plan => plan.status === 'failed' || plan.id === reopened);
  if (!visible.length) return null;
  return <section className="panel" style={{ marginBottom: 18 }}><div className="panel-heading"><div><h2>Route recovery</h2><p>Completed stops remain complete. Reopen only failed stops, review the remaining sequence, then approve.</p></div></div><div className="ops-queue">{visible.map(plan => <div className="ops-queue-row" key={plan.id}><span><strong>{plan.route_type.replace('_', ' ')} · {plan.route_date}</strong><small>{plan.route_stops.map(stop => `Stop ${stop.sequence}: ${stop.status}${stop.failure_reason ? ` (${stop.failure_reason})` : ''}`).join(' · ')}</small></span>{plan.status === 'failed' ? <Button size="sm" onClick={() => void action(plan, true)} disabled={busy === plan.id}><RotateCcw size={13}/>Reopen failed stops</Button> : <Button size="sm" onClick={() => void action(plan, false)} disabled={busy === plan.id}><Check size={13}/>Approve recovery</Button>}</div>)}</div></section>;
}
