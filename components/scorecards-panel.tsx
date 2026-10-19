'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { DateField } from './ui/date-field';
import type { Order, Processor } from '@/lib/types';
import { humanize } from '@/lib/presentation';

type Detail = { order_number: string; delivered_at: string; due_at?: string | null; issue?: string };
type Scorecard = { id: string; processor_id: string; period_start: string; period_end: string; orders_completed: number; on_time_rate: number; discrepancy_rate: number; issue_count: number; score: number; notes?: string | null; processors?: { name: string } | null; details?: Detail[] };

const csvCell = (value: string | number) => '"' + String(value).replaceAll('"', '""') + '"';
const localDate = (value: Date) => value.getFullYear() + '-' + String(value.getMonth() + 1).padStart(2, '0') + '-' + String(value.getDate()).padStart(2, '0');
const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value + 'T00:00:00'));
const formatDateTime = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const hasNoDeadline = (card: Scorecard) => card.notes?.includes('exact due timestamp') ?? false;

export default function ScorecardsPanel({ orders, processors, notify }: { orders: Order[]; processors: Processor[]; notify: (message: string) => void }) {
  const [cards, setCards] = useState<Scorecard[]>([]);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [periodStart, setPeriodStart] = useState(() => { const date = new Date(); return localDate(new Date(date.getFullYear(), date.getMonth(), 1)); });
  const [periodEnd, setPeriodEnd] = useState(() => localDate(new Date()));
  const load = useCallback(async () => {
    const response = await fetch('/api/scorecards', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) { notify(body.error || 'Unable to load processor scorecards'); return; }
    setCards(body.scorecards ?? []);
  }, [notify]);
  useEffect(() => { void load(); }, [load]);
  const latestCards = useMemo(() => {
    const latest = new Map<string, Scorecard>();
    for (const card of cards) {
      const previous = latest.get(card.processor_id);
      if (!previous || card.period_end > previous.period_end) latest.set(card.processor_id, card);
    }
    return [...latest.values()];
  }, [cards]);
  async function review() {
    if (!processors.length) { notify('Add a processor before running a scorecard review'); return; }
    setBusy(true);
    const results = await Promise.all(processors.map(async processor => {
      const response = await fetch('/api/scorecards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ processorId: processor.id, periodStart, periodEnd }) });
      const body = await response.json();
      return { ok: response.ok, error: body.error };
    }));
    setBusy(false);
    const failed = results.find(result => !result.ok);
    if (failed) { notify(failed.error || 'Some scorecards could not be updated'); return; }
    await load(); notify('Processor scorecards updated');
  }
  function exportCsv() {
    const rows = [['Processor', 'Completed', 'On time %', 'Issues', 'Issue rate %', 'Score', 'Period', 'Review note'], ...latestCards.map(card => [card.processors?.name ?? card.processor_id, card.orders_completed, hasNoDeadline(card) ? 'N/A' : card.on_time_rate, card.issue_count, card.discrepancy_rate, card.score, card.period_start + ' to ' + card.period_end, card.notes ?? ''])];
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([rows.map(row => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })); link.download = 'processor-scorecards.csv'; link.click(); URL.revokeObjectURL(link.href);
  }
  return <>
    <div className="page-heading"><div><div className="eyebrow">Performance review</div><h1>Operations reports</h1><p>Review completed deliveries and processor service quality for a clear date range.</p></div><div className="row-actions"><Button variant="outline" onClick={exportCsv} disabled={!latestCards.length}><Download size={14} />Export report</Button><Button onClick={() => void review()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={14} /> : <ShieldCheck size={14} />}{busy ? 'Reviewing…' : 'Run review'}</Button></div></div>
    <section className="panel report-controls"><div className="panel-heading"><div><h2>Review period</h2><p>Only deliveries completed during this period are included.</p></div></div><div className="form-grid form-grid-2"><label className="form-field"><span>From</span><DateField value={periodStart} max={periodEnd} onChange={event => setPeriodStart(event.target.value)} aria-label="Review period start" /></label><label className="form-field"><span>Through</span><DateField value={periodEnd} min={periodStart} max={localDate(new Date())} onChange={event => setPeriodEnd(event.target.value)} aria-label="Review period end" /></label></div></section>
    <div className="kpis"><div className="kpi"><div className="kpi-top"><span>Visible orders</span></div><div className="kpi-value">{orders.length}</div><div className="kpi-foot">Operational records in your workspace</div></div><div className="kpi"><div className="kpi-top"><span>Open issues</span></div><div className="kpi-value">{orders.filter(order => order.exception).length}</div><div className="kpi-foot">Current service issues</div></div><div className="kpi"><div className="kpi-top"><span>Processors</span></div><div className="kpi-value">{processors.length}</div><div className="kpi-foot">Configured service partners</div></div><div className="kpi"><div className="kpi-top"><span>Latest reviews</span></div><div className="kpi-value">{latestCards.length}</div><div className="kpi-foot">One current result per processor</div></div></div>
    <section className="panel report-explainer"><div><h2>How the score is calculated</h2><p>Completed means the delivery event happened in the selected period. On-time rate uses only orders with an exact deadline. Issues count unique orders with an issue recorded during that period.</p></div><div className="report-legend"><span><strong>60%</strong> on-time delivery</span><span><strong>40%</strong> issue-free delivery</span></div></section>
    <section className="panel"><div className="panel-heading"><div><h2>Processor scorecards</h2><p>Showing the latest saved review for each processor. Expand a row to inspect the completed orders behind the score.</p></div></div><div className="table-wrap"><table><thead><tr><th>Processor</th><th>Completed</th><th>On time</th><th>Issues</th><th>Issue rate</th><th>Score</th><th>Period</th></tr></thead><tbody>{latestCards.map(card => { const isExpanded = expanded === card.id; const details = card.details ?? []; return <Fragment key={card.id}><tr className={isExpanded ? 'report-row-expanded' : ''}><td><button className="report-expand-button" onClick={() => setExpanded(isExpanded ? null : card.id)} aria-expanded={isExpanded}>{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}<strong>{card.processors?.name ?? humanize(card.processor_id)}</strong></button>{hasNoDeadline(card) && <div className="customer-location report-note">No exact deadlines to measure</div>}</td><td>{card.orders_completed}</td><td>{hasNoDeadline(card) ? 'N/A' : card.on_time_rate + '%'}</td><td>{card.issue_count}</td><td>{card.discrepancy_rate}%</td><td><strong>{card.score}</strong></td><td>{formatDate(card.period_start)} – {formatDate(card.period_end)}</td></tr>{isExpanded && <tr className="report-detail-row"><td colSpan={7}>{details.length ? <div className="report-order-list">{details.map(detail => <div className="report-order-item" key={detail.order_number}><div><strong>{detail.order_number}</strong><span>Delivered {formatDateTime(detail.delivered_at)}</span></div><div><span>{detail.due_at ? 'Deadline ' + formatDateTime(detail.due_at) : 'No exact deadline'}</span><span className={detail.issue ? 'report-issue' : 'report-good'}>{detail.issue ? 'Issue: ' + detail.issue : 'No issue recorded'}</span></div></div>)}</div> : <div className="empty">No completed order details were found for this review period.</div>}</td></tr>}</Fragment>; })}</tbody></table>{!latestCards.length && <div className="empty">Choose a period and run a review after processor deliveries are completed.</div>}</div></section>
  </>;
}
