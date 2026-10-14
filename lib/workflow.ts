import type { Driver, OrderStatus, Processor } from './types';

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

export const networkProcessors: Processor[] = [
  { id: 'proc-northside', name: 'Northside Cleaners', address: '2741 N Lincoln Ave, Chicago', location: 'Lincoln Park', capabilities: ['Dry cleaning', 'Wash & fold'], pricing: '$1.85 / lb · $5.50 / bag', capacityLimit: 120, capacityUsed: 82, operatingHours: 'Mon–Sat · 7:00 AM–9:00 PM', turnaround: '18 hrs', score: 94, queue: 14, phone: '+1 312 555 0180', active: true },
  { id: 'proc-freshfold', name: 'FreshFold Hub', address: '910 W Fulton Market, Chicago', location: 'West Loop', capabilities: ['Commercial linen', 'Wash & fold'], pricing: '$1.55 / lb · $4.75 / bag', capacityLimit: 100, capacityUsed: 64, operatingHours: 'Mon–Sun · 6:00 AM–10:00 PM', turnaround: '22 hrs', score: 91, queue: 9, phone: '+1 312 555 0181', active: true },
  { id: 'proc-lakeshore', name: 'Lakeshore Laundry', address: '1550 S Wabash Ave, Chicago', location: 'South Loop', capabilities: ['Wash & fold', 'Specialty care'], pricing: '$1.95 / lb · $6.00 / bag', capacityLimit: 80, capacityUsed: 47, operatingHours: 'Mon–Fri · 8:00 AM–8:00 PM', turnaround: '26 hrs', score: 88, queue: 7, phone: '+1 312 555 0182', active: true }
];

export const drivers: Driver[] = [
  { id: 'driver-alex', name: 'Alex Morgan', phone: '+1 312 555 0110', availability: 'On route', zones: ['North Side', 'West Loop'], vehicle: 'Ford Transit · RL-04' },
  { id: 'driver-priya', name: 'Priya Shah', phone: '+1 312 555 0111', availability: 'Available', zones: ['South Loop', 'The Loop'], vehicle: 'Mercedes Sprinter · RL-07' },
  { id: 'driver-mateo', name: 'Mateo Ruiz', phone: '+1 312 555 0112', availability: 'Available', zones: ['West Side', 'Wicker Park'], vehicle: 'Ram ProMaster · RL-09' }
];

export const services = [
  { name: 'Wash & Fold', price: '$2.25 / lb', turnaround: '24–36 hrs', description: 'Everyday clothing, linens, and towels' },
  { name: 'Dry Cleaning', price: 'From $6.50 / item', turnaround: '48 hrs', description: 'Suits, shirts, dresses, and formalwear' },
  { name: 'Commercial Linen', price: '$1.55 / lb', turnaround: '24 hrs', description: 'Hotels, restaurants, studios, and clinics' },
  { name: 'Specialty Care', price: 'From $12.00 / item', turnaround: '72 hrs', description: 'Delicates, stain treatment, and specialty textiles' }
];

export const rules = {
  companyTimezone: 'America/Chicago', operatingDays: 'Monday–Saturday', holidays: 'New Year’s Day, Thanksgiving, Christmas Day',
  pickupWindows: ['8:00–10:00 AM', '10:00 AM–12:00 PM', '12:00–2:00 PM', '2:00–4:00 PM', '4:00–6:00 PM'],
  turnaround: { Standard: '48 hours', Priority: '36 hours', 'Same day': '8 hours' },
  bagRule: 'Driver counts sealed bags at every handoff; a discrepancy requires a note and photo.',
  exceptionRule: 'Damaged, missing, stained, or rejected items are held for dispatcher review and added to the scorecard.',
  notifications: ['Order validated', 'Processor acceptance requested', 'Pickup scheduled', 'Pickup completed', 'At processor', 'Ready for pickup', 'Out for delivery', 'Delivered', 'Exception recorded']
};

export const exceptionTypes = ['Pickup discrepancy', 'Processor discrepancy', 'Quality issue', 'Damaged item', 'Route issue', 'Missing customer specification'] as const;

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return transitionMap[from].includes(to);
}
