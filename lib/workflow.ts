import type { OrderStatus } from './types';

export const transitionMap: Record<OrderStatus, OrderStatus[]> = {
  Created: ['Validated'],
  Validated: ['Processor ranked'],
  'Processor ranked': ['Capacity confirmed', 'Validated'],
  'Capacity confirmed': ['Pickup scheduled', 'Processor ranked'],
  'Pickup scheduled': ['Picked up'],
  'Picked up': ['At processor'],
  'At processor': ['Processing'],
  Processing: ['Ready for pickup'],
  'Ready for pickup': ['Picked up from processor'],
  'Picked up from processor': ['QC / Reconciliation'],
  'QC / Reconciliation': ['Out for delivery', 'Processing'],
  'Out for delivery': ['Delivered'],
  Delivered: ['Processor reviewed'],
  'Processor reviewed': []
};

export const processors = [
  { name: 'Northside Cleaners', location: 'Lincoln Park', capabilities: 'Dry cleaning · Wash & fold', capacity: 82, turnaround: '18 hrs', score: 94, queue: 14, phone: '+1 312 555 0180' },
  { name: 'FreshFold Hub', location: 'West Loop', capabilities: 'Commercial linen · Wash & fold', capacity: 64, turnaround: '22 hrs', score: 91, queue: 9, phone: '+1 312 555 0181' },
  { name: 'Lakeshore Laundry', location: 'South Loop', capabilities: 'Wash & fold · Specialty care', capacity: 47, turnaround: '26 hrs', score: 88, queue: 7, phone: '+1 312 555 0182' }
];

export const exceptionTypes = ['Pickup discrepancy', 'Processor discrepancy', 'Quality issue', 'Damaged item', 'Route issue', 'Missing customer specification'] as const;

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return transitionMap[from].includes(to);
}
