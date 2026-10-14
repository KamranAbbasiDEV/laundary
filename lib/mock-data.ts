import type { Order, OrderStatus } from './types';

export const statuses: OrderStatus[] = ['Created','Validated','Processor ranked','Capacity confirmed','Pickup scheduled','Picked up','At processor','Processing','Ready for pickup','Picked up from processor','QC / Reconciliation','Out for delivery','Delivered','Processor reviewed'];

export const initialOrders: Order[] = [
  { id:'RL-1048', customer:'Amara Williams', phone:'+1 312 555 0142', address:'1847 N Damen Ave, Chicago', service:'Wash & Fold', items:'Everyday clothing', bags:3, due:'Today, 4:00 PM', status:'Pickup scheduled', processor:'Northside Cleaners', priority:'Priority', created:'8 min ago' },
  { id:'RL-1047', customer:'The Langley Hotel', phone:'+1 312 555 0176', address:'221 W Erie St, Chicago', service:'Commercial linen', items:'Sheets & towels', bags:12, due:'Today, 6:30 PM', status:'At processor', processor:'FreshFold Hub', priority:'Same day', created:'22 min ago', notes:'Keep hotel towels separate.' },
  { id:'RL-1046', customer:'Marcus Chen', phone:'+1 312 555 0198', address:'908 W Armitage Ave, Chicago', service:'Dry cleaning', items:'Suits & shirts', bags:2, due:'Tomorrow, 10:00 AM', status:'Processing', processor:'Northside Cleaners', priority:'Standard', created:'41 min ago' },
  { id:'RL-1045', customer:'Sofia Martinez', phone:'+1 312 555 0121', address:'1120 W Wilson Ave, Chicago', service:'Wash & Fold', items:'Delicates', bags:1, due:'Tomorrow, 1:00 PM', status:'Ready for pickup', processor:'Lakeshore Laundry', priority:'Priority', created:'1 hr ago', exception:'Missing item count' },
  { id:'RL-1044', customer:'Evelyn Brooks', phone:'+1 312 555 0188', address:'433 S Wabash Ave, Chicago', service:'Wash & Fold', items:'Everyday clothing', bags:4, due:'Tomorrow, 3:30 PM', status:'Out for delivery', processor:'FreshFold Hub', priority:'Standard', created:'2 hrs ago' },
  { id:'RL-1043', customer:'Riverside Pilates', phone:'+1 312 555 0164', address:'1600 N Milwaukee Ave, Chicago', service:'Commercial linen', items:'Studio towels', bags:7, due:'Oct 15, 11:00 AM', status:'Delivered', processor:'Lakeshore Laundry', priority:'Standard', created:'Yesterday' }
];

export const routeStops = [
  { order:'RL-1048', customer:'Amara Williams', address:'1847 N Damen Ave', window:'2:00 – 2:30 PM' },
  { order:'RL-1051', customer:'North Loop Dental', address:'910 W Fulton Market', window:'2:40 – 3:10 PM' },
  { order:'RL-1050', customer:'David Okafor', address:'622 N Kingsbury St', window:'3:20 – 3:50 PM' },
  { order:'RL-1049', customer:'The Robey Hotel', address:'2018 W North Ave', window:'4:10 – 4:40 PM' }
];
