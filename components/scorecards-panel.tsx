'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { DateField } from './ui/date-field';
import type { Order, Processor } from '@/lib/types';
import { humanize } from '@/lib/presentation';

type Detail = { order_number: string; delivered_at: string; due_at?: string | null; issue?: string };
type Scorecard = { id: string; processor_id: string; period_start: string; period_end: string; orders_completed: number; on_time_rate: number; discrepancy_rate: number; issue_count: number; score: number; notes?: string | null; processors?: { name: string } | null; details?: Detail[] };
const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
const localDate = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
const formatDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return value && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date) : 'an incomplete date';
};
const formatDateTime = (value: string) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date) : 'Unknown time';
};
const hasNoDeadline = (card: Scorecard) => card.notes?.includes('exact due timestamp') ?? false;
const insufficientData = (card: Scorecard) => card.orders_completed === 0;

async function readJson(response: Response, fallback: string) {
  const text = await response.text();
  let body: { error?: string; scorecards?: Scorecard[] } = {};
  try { body = text ? JSON.parse(text) : {}; } catch { /* Do not expose an HTML server error page. */ }
  if (!response.ok) throw new Error(body.error || fallback);
  return body;
}

export default function ScorecardsPanel({ orders, processors, notify }: { orders: Order[]; processors: Processor[]; notify: (message: string) => void }) {
  const [cards, setCards] = useState<Scorecard[]>([]); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [expanded, setExpanded] = useState<string | null>(null);
  const [periodStart, setPeriodStart] = useState(() => { const date = new Date(); return localDate(new Date(date.getFullYear(), date.getMonth(), 1)); });
  const [periodEnd, setPeriodEnd] = useState(() => localDate(new Date()));
  const validPeriod = Boolean(periodStart && periodEnd && periodStart <= periodEnd);
  const load = useCallback(async () => {
    if (!periodStart || !periodEnd || periodStart > periodEnd) { setCards([]); setError(''); return; }
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/scorecards?periodStart=${encodeURIComponent(periodStart)}&periodEnd=${encodeURIComponent(periodEnd)}`, { cache: 'no-store' });
      const body = await readJson(response, 'Unable to load processor scorecards. Please try again.');
      setCards(body.scorecards ?? []);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to load processor scorecards. Please try again.';
      setCards([]); setError(message);
    } finally { setLoading(false); }
  }, [periodStart, periodEnd]);
  useEffect(() => { void load(); }, [load]);
  const periodCards = useMemo(() => { const byProcessor = new Map<string, Scorecard>(); for (const card of cards) byProcessor.set(card.processor_id, card); return [...byProcessor.values()]; }, [cards]);
  async function review() {
    if (!processors.length) return notify('Add a processor before running a scorecard review');
    if (!validPeriod) return;
    setBusy(true); setError('');
    try {
      const results = await Promise.allSettled(processors.map(async processor => {
        const response = await fetch('/api/scorecards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ processorId: processor.id, periodStart, periodEnd }) });
        await readJson(response, `Unable to update ${processor.name}.`);
      }));
      const failed = results.filter(result => result.status === 'rejected');
      await load();
      if (failed.length) {
        const first = failed[0].status === 'rejected' && failed[0].reason instanceof Error ? failed[0].reason.message : 'Some scorecards could not be updated.';
        const message = failed.length === processors.length ? first : `${processors.length - failed.length} of ${processors.length} scorecards updated. ${first}`;
        setError(message); notify(message);
      } else notify('Processor scorecards updated for the selected period');
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to update processor scorecards.';
      setError(message); notify(message);
    } finally { setBusy(false); }
  }
  function exportCsv() { const rows = [['Processor', 'Completed', 'On time %', 'Issues', 'Issue rate %', 'Score', 'Period', 'Review note'], ...periodCards.map(card => [card.processors?.name ?? card.processor_id, card.orders_completed, hasNoDeadline(card) ? 'N/A' : card.on_time_rate, card.issue_count, insufficientData(card) ? 'N/A' : card.discrepancy_rate, insufficientData(card) ? 'N/A' : card.score, `${card.period_start} to ${card.period_end}`, card.notes ?? ''])]; const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([rows.map(row => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })); link.download = `processor-scorecards-${periodStart}-to-${periodEnd}.csv`; link.click(); URL.revokeObjectURL(link.href); }
  return <>
    <section className="panel report-controls"><div className="panel-heading"><div><h2>Review period</h2><p>Only deliveries completed during this exact workspace-local period are included. Future dates are allowed for testing and scheduled reporting.</p></div><div className="row-actions"><Button variant="outline" onClick={exportCsv} disabled={!periodCards.length || !validPeriod || loading}><Download size={14}/>Export selected period</Button><Button onClick={() => void review()} disabled={busy || loading || !validPeriod}>{busy ? <LoaderCircle className="spin" size={14}/> : <ShieldCheck size={14}/>}{busy ? 'Reviewing…' : 'Run review'}</Button></div></div><div className="form-grid form-grid-2"><label className="form-field"><span>From</span><DateField value={periodStart} onChange={event => setPeriodStart(event.target.value)} aria-label="Review period start"/></label><label className="form-field"><span>Through</span><DateField value={periodEnd} min={periodStart} onChange={event => setPeriodEnd(event.target.value)} aria-label="Review period end"/></label></div>{periodStart && periodEnd && periodStart > periodEnd && <div className="field-error" role="alert">The report end date must be on or after its start date.</div>}{error && <div className="report-error" role="alert"><span>{error}</span><Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>{loading ? 'Retrying…' : 'Retry'}</Button></div>}</section>
    <div className="kpis"><div className="kpi"><div className="kpi-top"><span>Visible orders</span></div><div className="kpi-value">{orders.length}</div><div className="kpi-foot">Operational records in your workspace</div></div><div className="kpi"><div className="kpi-top"><span>Open issues</span></div><div className="kpi-value">{orders.filter(order => order.exception).length}</div><div className="kpi-foot">Current service issues</div></div><div className="kpi"><div className="kpi-top"><span>Processors</span></div><div className="kpi-value">{processors.length}</div><div className="kpi-foot">Configured service partners</div></div><div className="kpi"><div className="kpi-top"><span>Reviews in period</span></div><div className="kpi-value">{periodCards.length}</div><div className="kpi-foot">Exact selected period</div></div></div>
    <section className="panel report-explainer"><div><h2>How the score is calculated</h2><p>Completed means the delivery event happened in the selected period. On-time rate uses only orders with an exact deadline. Issues count every exception recorded against those delivered orders, while issue rate measures the share of completed orders affected by at least one issue. No deliveries means no score.</p></div><div className="report-legend"><span><strong>60%</strong> on-time delivery</span><span><strong>40%</strong> issue-free delivery</span></div></section>
    <section className="panel"><div className="panel-heading"><div><h2>Processor scorecards</h2><p>{validPeriod ? <>Showing only saved reviews for {formatDate(periodStart)} through {formatDate(periodEnd)}. Expand a row to inspect the source orders.</> : 'Choose both dates to load or run a processor review.'}</p></div></div><div className="table-wrap"><table><thead><tr><th>Processor</th><th>Completed</th><th>On time</th><th>Issues</th><th>Issue rate</th><th>Score</th><th>Period</th></tr></thead><tbody>{periodCards.map(card => { const isExpanded = expanded === card.id; const details = card.details ?? []; return <Fragment key={card.id}><tr className={isExpanded ? 'report-row-expanded' : ''}><td><button className="report-expand-button" onClick={() => setExpanded(isExpanded ? null : card.id)} aria-expanded={isExpanded}>{isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}<strong>{card.processors?.name ?? humanize(card.processor_id)}</strong></button>{insufficientData(card) ? <div className="customer-location report-note">Not enough data</div> : hasNoDeadline(card) && <div className="customer-location report-note">No exact deadlines to measure</div>}</td><td>{card.orders_completed}</td><td>{hasNoDeadline(card) ? 'N/A' : `${card.on_time_rate}%`}</td><td>{card.issue_count}</td><td>{insufficientData(card) ? 'N/A' : `${card.discrepancy_rate}%`}</td><td><strong>{insufficientData(card) ? 'N/A' : card.score}</strong></td><td>{formatDate(card.period_start)} – {formatDate(card.period_end)}</td></tr>{isExpanded && <tr className="report-detail-row"><td colSpan={7}>{details.length ? <div className="report-order-list">{details.map(detail => <div className="report-order-item" key={detail.order_number}><div><strong>{detail.order_number}</strong><span>Delivered {formatDateTime(detail.delivered_at)}</span></div><div><span>{detail.due_at ? `Deadline ${formatDateTime(detail.due_at)}` : 'No exact deadline'}</span><span className={detail.issue ? 'report-issue' : 'report-good'}>{detail.issue ? `Issue: ${detail.issue}` : 'No issue recorded'}</span></div></div>)}</div> : <div className="empty">No completed order details were found for this review period.</div>}</td></tr>}</Fragment>; })}</tbody></table>{loading ? <div className="empty">Loading processor scorecards…</div> : !periodCards.length && <div className="empty">{validPeriod ? 'No saved review exists for this exact period. Run the review to calculate it.' : 'Choose a complete report period.'}</div>}</div></section>
  </>;
}
