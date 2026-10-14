import type { OrderStatus } from './types';

export const transitionMap: Record<OrderStatus, OrderStatus[]> = {
  Created: ['Validated'], Validated: ['Processor ranked'], 'Processor ranked': ['Capacity confirmed','Validated'], 'Capacity confirmed': ['Pickup scheduled','Processor ranked'], 'Pickup scheduled': ['Picked up'], 'Picked up': ['At processor'], 'At processor': ['Processing'], Processing: ['Ready for pickup'], 'Ready for pickup': ['Picked up from processor'], 'Picked up from processor': ['QC / Reconciliation'], 'QC / Reconciliation': ['Out for delivery','Processing'], 'Out for delivery': ['Delivered'], Delivered: ['Processor reviewed'], 'Processor reviewed': []
};

export const services = [
  { name:'Wash & Fold', price:'Set by workspace owner', turnaround:'Set by workspace owner', description:'Everyday clothing, linens, and towels' },
  { name:'Dry Cleaning', price:'Set by workspace owner', turnaround:'Set by workspace owner', description:'Suits, shirts, dresses, and formalwear' },
  { name:'Commercial Linen', price:'Set by workspace owner', turnaround:'Set by workspace owner', description:'Hotels, restaurants, studios, and clinics' },
  { name:'Specialty Care', price:'Set by workspace owner', turnaround:'Set by workspace owner', description:'Delicates, stain treatment, and specialty textiles' }
];

export const rules = {
  companyTimezone: 'Configured in workspace settings', operatingDays: 'Configured in workspace settings', holidays: 'Configured in workspace settings', pickupWindows: ['Configured in workspace settings'], turnaround: { Standard:'Configured in workspace settings', Priority:'Configured in workspace settings', 'Same day':'Configured in workspace settings' }, bagRule:'Driver counts sealed bags at every handoff; a discrepancy requires a note and photo.', exceptionRule:'Damaged, missing, stained, or rejected items are held for dispatcher review and added to the scorecard.', notifications:['Order validated','Processor acceptance requested','Pickup scheduled','Pickup completed','At processor','Ready for pickup','Out for delivery','Delivered','Exception recorded']
};

export const exceptionTypes = ['Pickup discrepancy','Processor discrepancy','Quality issue','Damaged item','Route issue','Missing customer specification'] as const;
export function canTransition(from:OrderStatus,to:OrderStatus) { return transitionMap[from].includes(to); }
