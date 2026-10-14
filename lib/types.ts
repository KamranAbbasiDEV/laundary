export type OrderStatus = 'Created' | 'Validated' | 'Processor ranked' | 'Capacity confirmed' | 'Pickup scheduled' | 'Picked up' | 'At processor' | 'Processing' | 'Ready for pickup' | 'Picked up from processor' | 'QC / Reconciliation' | 'Out for delivery' | 'Delivered' | 'Processor reviewed';

export type Order = {
  id: string;
  customer: string;
  phone: string;
  address: string;
  service: string;
  items: string;
  bags: number;
  due: string;
  status: OrderStatus;
  processor: string;
  priority: 'Standard' | 'Priority' | 'Same day';
  exception?: string;
  created: string;
  notes?: string;
  pickupWindow?: string;
  deliveryWindow?: string;
  actualBags?: number;
  processorBags?: number;
  completedBags?: number;
  customerEmail?: string;
  source?: 'Customer portal' | 'Staff entry' | 'CRM/API';
  timeline?: OrderEvent[];
};

export type UserRole = 'dispatcher' | 'driver' | 'processor' | 'customer';
export type OrderEvent = { status: OrderStatus; at: string; actor: string; note?: string };
export type Processor = { id: string; name: string; address: string; location: string; capabilities: string[]; pricing: string; capacityLimit: number; capacityUsed: number; operatingHours: string; turnaround: string; score: number; queue: number; phone: string; active: boolean };
export type Driver = { id: string; name: string; phone: string; availability: 'Available' | 'On route' | 'Off duty'; zones: string[]; vehicle: string };
export type RouteStop = { order: string; customer: string; address: string; window: string; kind: 'Pickup' | 'Processor drop-off' | 'Processor pickup' | 'Delivery'; complete?: boolean };
export type RoutePlan = { id: string; type: 'Pickup' | 'Return'; driver: string; date: string; stops: RouteStop[]; status: 'Draft' | 'Approved' | 'In progress' | 'Complete' };
export type NotificationLog = { id: string; channel: 'SMS' | 'Email' | 'In-app'; recipient: string; event: string; message: string; sentAt: string; status: 'Simulated' | 'Sent' | 'Failed' };
