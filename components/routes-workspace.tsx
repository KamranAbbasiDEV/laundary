'use client';

import { MapPinned } from 'lucide-react';
import RoutePlannerPanel from './route-planner-panel';
import RouteRecoveryPanel from './route-recovery-panel';
import type { Order } from '@/lib/types';

export default function RoutesWorkspace({ orders, notify }: { orders: Order[]; notify: (message: string) => void }) {
  return <div className="role-workspace routes-workspace"><div className="page-heading role-page-heading"><div><div className="eyebrow">Route operations</div><h1>Plan the next route</h1><p>Select the route type, choose eligible orders, assign a driver, then review the generated map.</p></div><span className="page-heading-icon"><MapPinned size={20}/></span></div><RouteRecoveryPanel notify={notify}/><RoutePlannerPanel orders={orders} notify={notify}/></div>;
}
