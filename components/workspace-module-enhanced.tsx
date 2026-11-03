'use client';

import WorkspaceModule from './workspace-module';
import SettingsPanel from './settings-panel';
import NotificationPreferencesPanel from './notification-preferences-panel';
import PaymentsPanel from './payments-panel';
import ProcessorWorkspace from './processor-workspace';
import RoutesWorkspace from './routes-workspace';
import DriverWorkflowPanel from './driver-workflow-panel';
import ProcessorManagerPanel from './processor-manager-panel';
import ReportsWorkspace from './reports-workspace';
import TeamAccessPanel from './team-access-panel';
import DispatchWorkspace from './dispatch-workspace';
import OrdersWorkspace from './orders-workspace';
import CustomerWorkspace from './customer-workspace';
import ClientsWorkspace from './clients-workspace';
import AdminDashboard from './admin-dashboard';
import type { OrderForm } from './new-order-modal';
import type { ServiceCatalogItem } from '@/lib/service-catalog';
import type { Order, OrderStatus, Processor, UserRole } from '@/lib/types';

type Props={active:string;orders:Order[];processors:Processor[];role:UserRole;services:ServiceCatalogItem[];onSelect:(order:Order)=>void;notify:(message:string)=>void;onStatusChange:(id:string,status:OrderStatus,note?:string)=>Promise<void>;onApproveRoute:(orderIds?:string[])=>void;onCreateOrder:(data:OrderForm)=>Promise<void>;onCreate:()=>void;onProcessorCreated:()=>Promise<void>;onNavigate?:(section:string)=>void;onOpenMatching:(order:Pick<Order,'id'|'internalId'>)=>void};
export default function EnhancedWorkspaceModule(props:Props){
  if(props.active==='Dashboard' && props.role==='super_admin') return <AdminDashboard orders={props.orders} processors={props.processors} onNavigate={props.onNavigate ?? (() => undefined)} onCreate={props.onCreate}/>;
  if(props.active==='Dashboard' && props.role==='dispatcher') return <OrdersWorkspace orders={props.orders} role={props.role} notify={props.notify} onRefresh={props.onProcessorCreated} onNavigate={props.onNavigate}/>;
  if(props.active==='Orders') return <OrdersWorkspace orders={props.orders} role={props.role} notify={props.notify} onRefresh={props.onProcessorCreated} onNavigate={props.onNavigate}/>;
  if(props.active==='Dispatch' && ['super_admin','dispatcher'].includes(props.role)) return <DispatchWorkspace orders={props.orders} onNavigate={props.onNavigate} onSelect={props.onSelect} notify={props.notify} onRefresh={props.onProcessorCreated} onOpenMatching={props.onOpenMatching} onReview={id => props.onStatusChange(id, 'Processor reviewed', 'Processor outcome reviewed by dispatch.')}/>;
  if(props.active==='Settings' && props.role==='super_admin') return <><SettingsPanel notify={props.notify}/><details className="panel settings-notification-disclosure"><summary><span>Personal notification preferences</span><small>In-app and SMS delivery for this account</small></summary><NotificationPreferencesPanel notify={props.notify} role={props.role}/></details></>;
  if(props.active==='Settings') return <div className="role-workspace settings-workspace"><div className="page-heading role-page-heading"><div><div className="eyebrow">Personal settings</div><h1>Notification preferences</h1><p>Configure how updates relevant to your role reach this account.</p></div></div><NotificationPreferencesPanel notify={props.notify} role={props.role}/></div>;
  if(props.active==='Team' && props.role==='super_admin') return <TeamAccessPanel processors={props.processors} notify={props.notify}/>;
  if(props.active==='Payments' && ['super_admin','dispatcher'].includes(props.role)) return <PaymentsPanel orders={props.orders} notify={props.notify}/>;
  if(props.active==='Routes' && ['super_admin','dispatcher'].includes(props.role)) return <RoutesWorkspace orders={props.orders} notify={props.notify}/>;
  if(props.active==='CRM' && ['super_admin','dispatcher'].includes(props.role)) return <ClientsWorkspace notify={props.notify}/>;
  if(props.active==='Driver app' && props.role==='driver') return <DriverWorkflowPanel orders={props.orders} notify={props.notify} onStatusChange={props.onStatusChange} onRefresh={props.onProcessorCreated}/>;
  if(props.active==='Customer portal' && props.role==='customer') return <CustomerWorkspace orders={props.orders} onRefresh={props.onProcessorCreated}/>;
  if(props.active==='Processors' && ['super_admin','dispatcher'].includes(props.role)) return <ProcessorManagerPanel processors={props.processors} notify={props.notify} onRefresh={props.onProcessorCreated}/>;
  if(props.active==='Reports' && ['super_admin','dispatcher'].includes(props.role)) return <ReportsWorkspace orders={props.orders} processors={props.processors} notify={props.notify}/>;
  if(props.active==='Processor portal' && props.role==='processor') return <ProcessorWorkspace orders={props.orders} notify={props.notify} onStatusChange={props.onStatusChange} onRefresh={props.onProcessorCreated}/>;
  const { onNavigate: _onNavigate, services: _services, onOpenMatching: _onOpenMatching, ...workspaceProps } = props;
  // The legacy workspace is retained as a fallback, but the enhanced workspace is the active path.
  return <WorkspaceModule {...workspaceProps} onCreateOrder={workspaceProps.onCreateOrder as unknown as Parameters<typeof WorkspaceModule>[0]['onCreateOrder']} />;
}
