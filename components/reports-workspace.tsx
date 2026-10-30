'use client';

import { useState } from 'react';
import { Clock3, Factory } from 'lucide-react';
import DeadlineCoverageReport from './deadline-coverage-report';
import ScorecardsPanel from './scorecards-panel';
import type { Order, Processor } from '@/lib/types';

export default function ReportsWorkspace({ orders, processors, notify }: { orders: Order[]; processors: Processor[]; notify: (message: string) => void }) {
  const [view, setView] = useState<'deadlines' | 'processors'>('deadlines');
  return <div className="role-workspace reports-workspace"><div className="page-heading role-page-heading"><div><div className="eyebrow">Operational reporting</div><h1>Reports</h1><p>Choose one reporting lens instead of scanning every metric at once.</p></div></div><nav className="report-view-tabs" aria-label="Report type"><button type="button" className={view === 'deadlines' ? 'active' : ''} onClick={() => setView('deadlines')}><Clock3 size={16}/><span><strong>Deadline health</strong><small>Commitments, coverage and late risk</small></span></button><button type="button" className={view === 'processors' ? 'active' : ''} onClick={() => setView('processors')}><Factory size={16}/><span><strong>Processor performance</strong><small>Quality, turnaround and issues</small></span></button></nav>{view === 'deadlines' ? <DeadlineCoverageReport orders={orders}/> : <ScorecardsPanel orders={orders} processors={processors} notify={notify}/>}</div>;
}
