'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Mail, RefreshCw, UserPlus, X } from 'lucide-react';
import { Button } from './ui/button';
import { FormModal } from './ui/form-modal';
import type { Processor, UserRole } from '@/lib/types';
import { humanize } from '@/lib/presentation';

type TeamUser = { id: string; full_name: string; role: UserRole; status: string; onboarding_complete?: boolean; processor_id?: string | null };
type Invitation = { id: string; email: string; full_name: string; role: UserRole; status: string; auth_user_id?: string | null };
type Application = { id: string; business_name: string; contact_name: string; email: string; address: string; capabilities: string[]; status: string };
type InviteForm = { fullName: string; email: string; role: 'dispatcher' | 'driver' | 'processor'; phone: string; processorId: string };

const badge = (value: string) => <span className={`status ${value === 'active' || value === 'accepted' || value === 'complete' ? 'status-green' : value === 'suspended' || value === 'rejected' ? 'status-red' : 'status-amber'}`}>{humanize(value)}</span>;

export default function TeamAccessPanel({ processors, notify }: { processors: Processor[]; notify: (message: string) => void }) {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [invite, setInvite] = useState<InviteForm>({ fullName: '', email: '', role: 'driver', phone: '', processorId: '' });
  const [processorAssignments, setProcessorAssignments] = useState<Record<string, string>>({});
  const [inviteOpen, setInviteOpen] = useState(false);
  const [view, setView] = useState<'accounts' | 'applications' | 'invitations'>('accounts');
  const [busy, setBusy] = useState(''); const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const responses = await Promise.all([fetch('/api/admin/users'), fetch('/api/admin/invitations'), fetch('/api/processor-applications')]);
      const bodies = await Promise.all(responses.map(response => response.json()));
      if (responses.some(response => !response.ok)) { notify('Unable to load team access records'); return; }
      setUsers(bodies[0].users ?? []);
      setInvitations(bodies[1].invitations ?? []);
      setApplications(bodies[2].applications ?? []);
    } finally { setLoading(false); }
  }, [notify]);

  useEffect(() => { void load(); const refresh = () => void load(); window.addEventListener('rinseline:data-changed', refresh); return () => window.removeEventListener('rinseline:data-changed', refresh); }, [load]);
  const pendingByUser = useMemo(() => new Map(invitations.filter(item => item.status === 'pending' && item.auth_user_id).map(item => [item.auth_user_id as string, item])), [invitations]);

  async function sendInvite() {
    if (!invite.fullName.trim() || !invite.email.trim()) { notify('Name and email are required'); return; }
    if (invite.role === 'processor' && !invite.processorId) { notify('Choose the approved processor this account represents'); return; }
    setBusy('invite');
    const response = await fetch('/api/admin/invitations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...invite, processorId: invite.processorId || undefined }) });
    const body = await response.json();
    setBusy('');
    if (!response.ok) { notify(body.error || 'Unable to send invitation'); return; }
    setInvite({ fullName: '', email: '', role: 'driver', phone: '', processorId: '' });
    setInviteOpen(false);
    notify('Setup invitation sent');
    await load();
  }

  async function resend(invitation: Invitation) {
    setBusy(invitation.id);
    const response = await fetch(`/api/admin/invitations/${invitation.id}/resend`, { method: 'POST' });
    const body = await response.json();
    setBusy('');
    if (!response.ok) { notify(body.error || 'Unable to resend account setup'); return; }
    notify(body.restored ? 'Account restored and a new invitation was sent' : 'Password setup link sent');
    await load();
  }

  async function changeStatus(user: TeamUser, status: 'active' | 'suspended') {
    setBusy(user.id);
    const response = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, status }) });
    const body = await response.json();
    setBusy('');
    if (!response.ok) { notify(body.error || 'Unable to update account'); return; }
    notify(status === 'suspended' ? 'Account suspended' : 'Account reactivated');
    await load();
  }
  async function linkProcessor(user: TeamUser) {
    const processorId = processorAssignments[user.id] ?? user.processor_id ?? '';
    if (!processorId) { notify('Choose the processor facility this account represents'); return; }
    setBusy(user.id);
    const response = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, processorId }) });
    const body = await response.json();
    setBusy('');
    if (!response.ok) { notify(body.error || 'Unable to link processor account'); return; }
    notify('Processor account linked to its facility');
    await load();
  }

  async function review(application: Application, status: 'approved' | 'rejected') {
    setBusy(application.id);
    const response = await fetch('/api/processor-applications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: application.id, status }) });
    const body = await response.json();
    setBusy('');
    if (!response.ok) { notify(body.error || 'Unable to review processor application'); return; }
    notify(status === 'approved' ? 'Processor approved. Invite its account from the form above.' : 'Processor application rejected');
    await load();
  }

  return <>
    <div className="page-heading"><div><div className="eyebrow">Access management</div><h1>Team and invitations</h1><p>Invite staff, restore an incomplete invitation, and manage access without bypassing secure onboarding.</p></div><Button onClick={() => setInviteOpen(true)}><UserPlus size={14} />Invite member</Button></div>

    {inviteOpen && <FormModal title="Invite a team member" description="Drivers, dispatchers, and processors complete secure setup before access activates." onClose={() => setInviteOpen(false)} labelledBy="invite-form-title" footer={<><Button variant="outline" onClick={() => setInviteOpen(false)} disabled={busy === 'invite'}>Cancel</Button><Button onClick={() => void sendInvite()} disabled={busy === 'invite'}><UserPlus size={14} />{busy === 'invite' ? 'Sending...' : 'Send invitation'}</Button></>}><div className="modal-body"><div className="form-grid">
      <div className="form-field"><label>Full name</label><input className="form-control" value={invite.fullName} onChange={event => setInvite({ ...invite, fullName: event.target.value })} placeholder="Team member name" /></div>
      <div className="form-field"><label>Email</label><input className="form-control" type="email" value={invite.email} onChange={event => setInvite({ ...invite, email: event.target.value })} placeholder="name@company.com" /></div>
      <div className="form-field"><label>Role</label><select className="form-control" value={invite.role} onChange={event => setInvite({ ...invite, role: event.target.value as InviteForm['role'], processorId: '' })}><option value="driver">Driver</option><option value="dispatcher">Dispatcher</option><option value="processor">Processor</option></select></div>
      <div className="form-field"><label>Phone</label><input className="form-control" value={invite.phone} onChange={event => setInvite({ ...invite, phone: event.target.value })} placeholder="Optional phone number" /></div>
      {invite.role === 'processor' && <div className="form-field full"><label>Approved processor</label><select className="form-control" value={invite.processorId} onChange={event => setInvite({ ...invite, processorId: event.target.value })}><option value="">Choose a processor</option>{processors.map(processor => <option key={processor.id} value={processor.id}>{processor.name}</option>)}</select></div>}
    </div></div></FormModal>}

    <nav className="team-view-tabs" aria-label="Team access sections"><button type="button" className={view === 'accounts' ? 'active' : ''} onClick={() => setView('accounts')}><strong>Current accounts</strong><span>{users.length}</span></button><button type="button" className={view === 'applications' ? 'active' : ''} onClick={() => setView('applications')}><strong>Processor applications</strong><span>{applications.filter(item => item.status === 'pending').length}</span></button><button type="button" className={view === 'invitations' ? 'active' : ''} onClick={() => setView('invitations')}><strong>Invitation history</strong><span>{invitations.length}</span></button></nav>

    {view === 'applications' && <section className="panel"><div className="panel-heading"><div><h2>Processor applications</h2><p>Approve facilities before inviting their processor account.</p></div></div><div className="table-wrap"><table><thead><tr><th>Business</th><th>Contact</th><th>Capabilities</th><th>Status</th><th>Decision</th></tr></thead><tbody>{applications.map(application => <tr key={application.id}><td>{application.business_name}<div className="customer-location">{application.address}</div></td><td>{application.contact_name}<div className="customer-location">{application.email}</div></td><td>{application.capabilities.join(' · ')}</td><td>{badge(application.status)}</td><td>{application.status === 'pending' && <div style={{ display: 'flex', gap: 7 }}><Button size="sm" onClick={() => void review(application, 'approved')} disabled={busy === application.id}><Check size={13} />Approve</Button><Button size="sm" variant="destructive" onClick={() => void review(application, 'rejected')} disabled={busy === application.id}><X size={13} />Reject</Button></div>}</td></tr>)}</tbody></table>{!applications.length && <div className="empty">No processor applications yet.</div>}</div></section>}

    {view === 'accounts' && <section className="panel"><div className="panel-heading"><div><h2>Current accounts</h2><p>Access, onboarding and facility links for active workspace members.</p></div><Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? 'spin' : ''} size={14}/>Refresh</Button></div><div className="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Access</th><th>Setup</th><th>Action</th></tr></thead><tbody>{users.map(user => { const pending = pendingByUser.get(user.id); const setup = user.onboarding_complete ? 'complete' : pending ? 'setup pending' : 'not started'; return <tr key={user.id}><td>{user.full_name}</td><td>{badge(user.role)}</td><td>{badge(user.status)}</td><td>{badge(setup)}</td><td>{user.role !== 'super_admin' && <div className="row-actions">{user.role === 'processor' && <><select className="form-control team-processor-select" aria-label={`Processor facility for ${user.full_name}`} value={processorAssignments[user.id] ?? user.processor_id ?? ''} onChange={event => setProcessorAssignments(current => ({ ...current, [user.id]: event.target.value }))}><option value="">Link facility</option>{processors.map(processor => <option key={processor.id} value={processor.id}>{processor.name}</option>)}</select><Button size="sm" variant="outline" onClick={() => void linkProcessor(user)} disabled={busy === user.id || !(processorAssignments[user.id] ?? user.processor_id)}>Link</Button></>}{pending && !user.onboarding_complete && <Button size="sm" variant="outline" onClick={() => void resend(pending)} disabled={busy === pending.id}><Mail size={13}/>Resend setup</Button>}{user.status === 'active' && <Button size="sm" variant="destructive" onClick={() => void changeStatus(user,'suspended')} disabled={busy === user.id}>Suspend</Button>}{user.status === 'suspended' && user.onboarding_complete && <Button size="sm" onClick={() => void changeStatus(user,'active')} disabled={busy === user.id}>Reactivate</Button>}</div>}</td></tr>; })}</tbody></table>{!users.length && <div className="empty">No team accounts found.</div>}</div></section>}
    {view === 'invitations' && <section className="panel"><div className="panel-heading"><div><h2>Invitation history</h2><p>Restore an incomplete invitation without removing an existing account.</p></div></div><div className="table-wrap"><table><thead><tr><th>Recipient</th><th>Role</th><th>Setup status</th><th>Action</th></tr></thead><tbody>{invitations.map(invitation => <tr key={invitation.id}><td>{invitation.full_name}<div className="customer-location">{invitation.email}</div></td><td>{invitation.role}</td><td>{badge(invitation.status)}</td><td>{invitation.status === 'pending' && !invitation.auth_user_id && <Button size="sm" variant="outline" onClick={() => void resend(invitation)} disabled={busy === invitation.id}><Mail size={13}/>{busy === invitation.id ? 'Restoring...' : 'Restore account'}</Button>}</td></tr>)}</tbody></table>{!invitations.length && <div className="empty">No invitations sent yet.</div>}</div></section>}
  </>;
}
