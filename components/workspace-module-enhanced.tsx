'use client';

import WorkspaceModule from './workspace-module';
import SettingsPanel from './settings-panel';
import PaymentsPanel from './payments-panel';
import ProcessorOffersPanel from './processor-offers-panel';
import RoutePlannerPanel from './route-planner-panel';
import DriverWorkflowPanel from './driver-workflow-panel';
import ProcessorManagerPanel from './processor-manager-panel';
import ScorecardsPanel from './scorecards-panel';
import type { Order, OrderStatus, Processor, UserRole } from '@/lib/types';

type Props={active:string;orders:Order[];processors:Processor[];role:UserRole;onSelect:(order:Order)=>void;notify:(message:string)=>void;onStatusChange:(id:string,status:OrderStatus,note?:string)=>void;onApproveRoute:(orderIds?:string[])=>void;onCreateOrder:(data:{customer:string;phone:string;address:string;service:string;bags:number;due:string;notes?:string})=>void;onProcessorCreated:()=>Promise<void>};
export default function EnhancedWorkspaceModule(props:Props){
  if(props.active==='Settings' && props.role==='super_admin') return <SettingsPanel notify={props.notify}/>;
  if(props.active==='Payments' && ['super_admin','dispatcher'].includes(props.role)) return <PaymentsPanel orders={props.orders} notify={props.notify}/>;
  if(props.active==='Routes' && ['super_admin','dispatcher'].includes(props.role)) return <RoutePlannerPanel orders={props.orders} notify={props.notify} onApproveRoute={props.onApproveRoute}/>;
  if(props.active==='Driver app' && props.role==='driver') return <DriverWorkflowPanel orders={props.orders} notify={props.notify} onStatusChange={props.onStatusChange}/>;
  if(props.active==='Processors' && ['super_admin','dispatcher'].includes(props.role)) return <ProcessorManagerPanel processors={props.processors} notify={props.notify} onRefresh={props.onProcessorCreated}/>;
  if(props.active==='Reports' && ['super_admin','dispatcher'].includes(props.role)) return <ScorecardsPanel orders={props.orders} processors={props.processors} notify={props.notify}/>;
  if(props.active==='Processor portal' && props.role==='processor') return <><ProcessorOffersPanel notify={props.notify}/><WorkspaceModule {...props}/></>;
  return <WorkspaceModule {...props}/>;
}
