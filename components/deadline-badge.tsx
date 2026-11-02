import type { Order } from '@/lib/types';
import { deadlineStatusLabel, deadlineStatusTone } from '@/lib/deadlines';

export default function DeadlineBadge({ order }: { order: Order }) {
  if (!order.deadlineStatus || order.deadlineStatus === 'no_deadline') return <span className="deadline-badge deadline-badge-empty">No deadline</span>;
  const label = ['due_today', 'due_soon', 'at_risk'].includes(order.deadlineStatus) ? 'At risk' : deadlineStatusLabel[order.deadlineStatus];
  return <span className="deadline-badge"><span className={`status status-${deadlineStatusTone[order.deadlineStatus]}`}>{label}</span><small>{order.deadlineDelta ?? ''}</small></span>;
}
