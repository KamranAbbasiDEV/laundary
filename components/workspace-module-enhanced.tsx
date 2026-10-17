'use client';

import WorkspaceModule from './workspace-module';
import SettingsPanel from './settings-panel';
import NotificationPreferencesPanel from './notification-preferences-panel';
import PaymentsPanel from './payments-panel';
import ProcessorWorkspace from './processor-workspace';
import RoutePlannerPanel from './route-planner-panel';
import RouteRecoveryPanel from './route-recovery-panel';
import DriverWorkflowPanel from './driver-workflow-panel';
import ProcessorManagerPanel from './processor-manager-panel';
import ScorecardsPanel from './scorecards-panel';
import TeamAccessPanel from './team-access-panel';
import DispatchWorkspace from './dispatch-workspace';
import OrdersWorkspace from './orders-workspace';
import CustomerWorkspace from './customer-workspace';
import type { Order, OrderStatus, Processor, UserRole } from '@/lib/types';

type Props={active:string;orders:Order[];processors:Processor[];role:UserRole;onSelect:(order:Order)=>void;notify:(message:string)=>void;onStatusChange:(id:string,status:OrderStatus,note?:string)=>Promise<void>;onApproveRoute:(orderIds?:string[])=>void;onCreateOrder:(data:{customer:string;phone:string;address:string;service:string;bags:number;due:string;notes?:string})=>Promise<void>;onCreate:()=>void;onProcessorCreated:()=>Promise<void>;onNavigate?:(section:string)=>void};
export default function EnhancedWorkspaceModule(props:Props){
  if(props.active==='Orders') return <OrdersWorkspace orders={props.orders} role={props.role} onRefresh={props.onProcessorCreated} onCreate={props.onCreate}/>;
  if(props.active==='Dispatch' && ['super_admin','dispatcher'].includes(props.role)) return <DispatchWorkspace orders={props.orders} onNavigate={props.onNavigate} onSelect={props.onSelect} notify={props.notify} onRefresh={props.onProcessorCreated}/>;
  if(props.active==='Settings' && props.role==='super_admin') return <><SettingsPanel notify={props.notify}/><NotificationPreferencesPanel notify={props.notify}/></>;
  if(props.active==='Team' && props.role==='super_admin') return <TeamAccessPanel processors={props.processors} notify={props.notify}/>;
  if(props.active==='Payments' && ['super_admin','dispatcher'].includes(props.role)) return <PaymentsPanel orders={props.orders} notify={props.notify}/>;
  if(props.active==='Routes' && ['super_admin','dispatcher'].includes(props.role)) return <><RouteRecoveryPanel notify={props.notify}/><RoutePlannerPanel orders={props.orders} notify={props.notify}/></>;
  if(props.active==='Driver app' && props.role==='driver') return <DriverWorkflowPanel orders={props.orders} notify={props.notify} onStatusChange={props.onStatusChange}/>;
  if(props.active==='Customer portal' && props.role==='customer') return <CustomerWorkspace orders={props.orders} notify={props.notify} onCreateOrder={props.onCreateOrder}/>;
  if(props.active==='Processors' && ['super_admin','dispatcher'].includes(props.role)) return <ProcessorManagerPanel processors={props.processors} notify={props.notify} onRefresh={props.onProcessorCreated}/>;
  if(props.active==='Reports' && ['super_admin','dispatcher'].includes(props.role)) return <ScorecardsPanel orders={props.orders} processors={props.processors} notify={props.notify}/>;
  if(props.active==='Processor portal' && props.role==='processor') return <ProcessorWorkspace orders={props.orders} notify={props.notify} onStatusChange={props.onStatusChange}/>;
  const { onNavigate: _onNavigate, ...workspaceProps } = props;
  return <WorkspaceModule {...workspaceProps}/>;
}
