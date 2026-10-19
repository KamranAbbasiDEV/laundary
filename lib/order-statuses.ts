import type { OrderStatus } from './types';

export const statuses: OrderStatus[] = ['Created','Validated','Processor ranked','Capacity confirmed','Pickup scheduled','Picked up','At processor','Processing','Ready for pickup','Picked up from processor','QC / Reconciliation','Out for delivery','Delivered','Processor reviewed'];

export const statusGroups: Array<{ id: string; label: string; statuses: OrderStatus[] }> = [
  { id: 'intake', label: 'Intake', statuses: ['Created', 'Validated'] },
  { id: 'matching', label: 'Awaiting processor', statuses: ['Processor ranked', 'Capacity confirmed'] },
  { id: 'pickup', label: 'Pickup', statuses: ['Pickup scheduled', 'Picked up'] },
  { id: 'processing', label: 'Processing', statuses: ['At processor', 'Processing', 'Ready for pickup'] },
  { id: 'return', label: 'Return and delivery', statuses: ['Picked up from processor', 'QC / Reconciliation', 'Out for delivery'] },
  { id: 'completed', label: 'Completed', statuses: ['Delivered', 'Processor reviewed'] }
];

export function statusToneClass(status: OrderStatus): string {
  if (['Created', 'Validated'].includes(status)) return 'status-blue';
  if (['Processor ranked', 'Capacity confirmed'].includes(status)) return 'status-amber';
  if (['Pickup scheduled', 'Picked up'].includes(status)) return 'status-purple';
  if (['At processor', 'Processing', 'Ready for pickup'].includes(status)) return 'status-amber';
  if (['Picked up from processor', 'QC / Reconciliation', 'Out for delivery'].includes(status)) return 'status-teal';
  return 'status-green';
}
