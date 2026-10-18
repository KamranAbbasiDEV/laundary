'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import type { Order, Processor } from '@/lib/types';

type Scorecard = { id: string; processor_id: string; orders_completed: number; on_time_rate: number; discrepancy_rate: number; issue_count: number; score: number; notes?: string | null; processors?: { name: string } | null };
const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
const localDate = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

export default function ScorecardsPanel({ orders, processors, notify }: { orders: Order[]; processors: Processor[]; notify: (message: string) => void }) {
  const [cards, setCards] = useState<Scorecard[]>([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch('/api/scorecards');
    const body = await response.json();
    if (!response.ok) { notify(body.error || 'Unable to load processor scorecards'); return; }
    setCards(body.scorecards ?? []);
  }, [notify]);
  useEffect(() => { void load(); }, [load]);

  async function review() {
    if (!processors.length) { notify('Add a processor before running a scorecard review'); return; }
    setBusy(true);
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    const results = await Promise.all(processors.map(async processor => {
      const response = await fetch('/api/scorecards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ processorId: processor.id, periodStart: localDate(start), periodEnd: localDate(end) }) });
      const body = await response.json();
      return { ok: response.ok, error: body.error };
    }));
    setBusy(false);
    const failed = results.find(result => !result.ok);
    if (failed) { notify(failed.error || 'Some scorecards could not be updated'); return; }
    await load();
    notify('Processor scorecards updated');
  }

  function exportCsv() {
    const rows = [['Processor', 'Completed', 'On time %', 'Discrepancy %', 'Issues', 'Score', 'Review note'], ...cards.map(card => [card.processors?.name ?? card.processor_id, card.orders_completed, card.notes?.includes('No completed order in this period had an exact due timestamp') ? 'N/A' : card.on_time_rate, card.discrepancy_rate, card.issue_count, card.score, card.notes ?? ''])];
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([rows.map(row => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }));
    link.download = 'processor-scorecards.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return <>
    <div className="page-heading"><div><div className="eyebrow">Performance review</div><h1>Operations reports</h1><p>Review delivery activity, reconciliation, service exceptions, and processor performance.</p></div><div style={{ display: 'flex', gap: 8 }}><Button variant="outline" onClick={exportCsv} disabled={!cards.length}><Download size={14} />Export scorecards</Button><Button onClick={() => void review()} disabled={busy}><ShieldCheck size={14} />{busy ? 'Reviewing…' : 'Run scorecard review'}</Button></div></div>
    <div className="kpis"><div className="kpi"><div className="kpi-top"><span>Orders</span></div><div className="kpi-value">{orders.length}</div><div className="kpi-foot">Visible operational records</div></div><div className="kpi"><div className="kpi-top"><span>Exceptions</span></div><div className="kpi-value">{orders.filter(order => order.exception).length}</div><div className="kpi-foot">Open service issues</div></div><div className="kpi"><div className="kpi-top"><span>Processors</span></div><div className="kpi-value">{processors.length}</div><div className="kpi-foot">Configured network</div></div><div className="kpi"><div className="kpi-top"><span>Reviewed cards</span></div><div className="kpi-value">{cards.length}</div><div className="kpi-foot">Saved review periods</div></div></div>
    <section className="panel"><div className="panel-heading"><div><h2>Processor scorecards</h2><p>Completed orders are counted by actual delivery date. On-time performance uses exact due timestamps only.</p></div></div><div className="table-wrap"><table><thead><tr><th>Processor</th><th>Completed</th><th>On time</th><th>Discrepancies</th><th>Issues</th><th>Score</th></tr></thead><tbody>{cards.map(card => <tr key={card.id}><td>{card.processors?.name ?? card.processor_id}{card.notes?.includes('Turnaround is neutral') && <div className="customer-location">No exact deadlines in this period</div>}</td><td>{card.orders_completed}</td><td>{card.notes?.includes('Turnaround is neutral') ? 'N/A' : `${card.on_time_rate}%`}</td><td>{card.discrepancy_rate}%</td><td>{card.issue_count}</td><td>{card.score}</td></tr>)}</tbody></table>{!cards.length && <div className="empty">Run a scorecard review after completing processor orders.</div>}</div></section>
  </>;
}
