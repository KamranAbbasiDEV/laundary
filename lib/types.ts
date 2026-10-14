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
};
