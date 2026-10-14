import type { OrderStatus } from './types';

export const statuses: OrderStatus[] = ['Created','Validated','Processor ranked','Capacity confirmed','Pickup scheduled','Picked up','At processor','Processing','Ready for pickup','Picked up from processor','QC / Reconciliation','Out for delivery','Delivered','Processor reviewed'];
