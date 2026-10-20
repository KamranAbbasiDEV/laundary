import type { Order } from '@/lib/types';
import { deadlineStatusLabel, deadlineStatusTone } from '@/lib/deadlines';

export default function DeadlineBadge({ order }: { order: Order }) {
  if (!order.deadlineStatus || order.deadlineStatus === 'no_deadline') return <span className="deadline-badge deadline-badge-empty">No deadline</span>;
  return <span className="deadline-badge"><span className={`status status-${deadlineStatusTone[order.deadlineStatus]}`}>{deadlineStatusLabel[order.deadlineStatus]}</span><small>{order.deadlineDelta ?? ''}</small></span>;
}
