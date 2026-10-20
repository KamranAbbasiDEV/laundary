import type { OrderStatus } from './types';

export type DeadlineStatus = 'on_track' | 'due_today' | 'due_soon' | 'at_risk' | 'overdue' | 'delivered_on_time' | 'delivered_late' | 'no_deadline';

const completedStatuses: OrderStatus[] = ['Delivered', 'Processor reviewed'];

export function getDeadlineStatus(input: { deadline?: string | null; actualCompletionAt?: string | null; orderStatus?: OrderStatus | string; atRisk?: boolean; now?: Date }): DeadlineStatus {
  if (!input.deadline) return 'no_deadline';
  const deadline = new Date(input.deadline).getTime();
  if (completedStatuses.includes(input.orderStatus as OrderStatus)) {
    return input.actualCompletionAt && new Date(input.actualCompletionAt).getTime() <= deadline ? 'delivered_on_time' : 'delivered_late';
  }
  const now = input.now ?? new Date();
  if (now.getTime() > deadline) return 'overdue';
  if (input.atRisk) return 'at_risk';
  const endToday = new Date(now); endToday.setHours(23, 59, 59, 999);
  if (new Date(input.deadline).toDateString() === now.toDateString()) return 'due_today';
  if (deadline - now.getTime() <= 24 * 60 * 60 * 1000) return 'due_soon';
  return endToday.getTime() > deadline && deadline >= now.getTime() ? 'due_today' : 'on_track';
}

export const deadlineStatusLabel: Record<DeadlineStatus, string> = { on_track: 'On track', due_today: 'Due today', due_soon: 'Due soon', at_risk: 'At risk', overdue: 'Overdue', delivered_on_time: 'Delivered on time', delivered_late: 'Delivered late', no_deadline: 'No deadline' };
export const deadlineStatusTone: Record<DeadlineStatus, string> = { on_track: 'green', due_today: 'amber', due_soon: 'amber', at_risk: 'amber', overdue: 'red', delivered_on_time: 'green', delivered_late: 'red', no_deadline: 'blue' };

export function formatDeadlineDelta(deadline?: string | null, now = new Date()) {
  if (!deadline) return 'No exact deadline';
  const minutes = Math.round((new Date(deadline).getTime() - now.getTime()) / 60000);
  if (minutes < 0) { const value = Math.abs(minutes); return `${Math.floor(value / 1440)}d ${Math.floor((value % 1440) / 60)}h overdue`; }
  if (minutes < 60) return `${Math.max(1, minutes)}m remaining`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m remaining`;
  return `${Math.floor(minutes / 1440)}d remaining`;
}
