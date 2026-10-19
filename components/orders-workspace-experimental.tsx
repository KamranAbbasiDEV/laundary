'use client';

import OrdersWorkspace from './orders-workspace';
import type { Order, UserRole } from '@/lib/types';

type Props = { orders: Order[]; role: UserRole; notify: (message: string) => void; onRefresh: () => Promise<void>; onCreate: () => void; onNavigate?: (section: string) => void };

/** Isolated presentation wrapper for testing the full-width Orders layout. */
export default function ExperimentalOrdersWorkspace(props: Props) {
  return <div className="orders-experimental-shell"><OrdersWorkspace {...props} /></div>;
}
