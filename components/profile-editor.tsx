'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Save, UserRound, X } from 'lucide-react';
import type { UserRole } from '@/lib/types';
import { humanize } from '@/lib/presentation';
import { Button } from './ui/button';

type ProfileData = {
  id?: string;
  full_name: string;
  role: UserRole;
  status?: string;
  phone?: string;
  address?: string;
  service_zones?: string[];
  availability?: string;
  vehicle_details?: string;
};

type FormState = { fullName: string; phone: string; address: string; serviceZones: string; availability: string; vehicleDetails: string };

const emptyForm: FormState = { fullName: '', phone: '', address: '', serviceZones: '', availability: '', vehicleDetails: '' };

function ProfileEditorContent({ onClose, onSaved }: { onClose: () => void; onSaved: (profile: ProfileData) => void }) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    let active = true;
    void fetch('/api/profile', { cache: 'no-store' }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load your profile.');
      if (!active) return;
      setProfile(body.profile);
      setForm({
        fullName: body.profile.full_name ?? '',
        phone: body.profile.phone ?? '',
        address: body.profile.address ?? '',
        serviceZones: (body.profile.service_zones ?? []).join(', '),
        availability: body.profile.availability ?? '',
        vehicleDetails: body.profile.vehicle_details ?? ''
      });
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load your profile.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; document.body.style.overflow = previousOverflow; };
  }, []);

  const update = (key: keyof FormState, value: string) => setForm(current => ({ ...current, [key]: value }));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form.fullName.trim() || form.fullName.trim().length < 2) return setError('Enter your full name.');
    if (!form.phone.trim() || form.phone.trim().length < 7) return setError('Enter a valid phone number.');
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, fullName: form.fullName.trim(), phone: form.phone.trim(), serviceZones: form.serviceZones.split(',').map(value => value.trim()).filter(Boolean) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to save your profile.');
      onSaved(body.profile);
      onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save your profile.'); } finally { setSaving(false); }
  }

  const role = profile?.role;
  const isDriver = role === 'driver';
  const isProcessor = role === 'processor';

  return <div className="profile-editor-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose(); }}><section className="profile-editor-modal" role="dialog" aria-modal="true" aria-labelledby="profile-editor-title"><header className="profile-editor-header"><div><span className="eyebrow">Account settings</span><h2 id="profile-editor-title">Edit profile</h2><p>Update the personal details used across your workspace.</p></div><button className="icon-button" type="button" aria-label="Close profile editor" onClick={onClose} disabled={saving}><X size={17}/></button></header>{loading ? <div className="profile-editor-loading">Loading profile…</div> : <form className="profile-editor-body" onSubmit={save}><div className="profile-editor-identity"><span className="profile-editor-avatar"><UserRound size={18}/></span><div><strong>{profile?.full_name || 'Workspace user'}</strong><span>{profile?.role ? humanize(profile.role) : 'Workspace user'}</span></div></div><div className="profile-editor-grid"><label className="form-field"><span>Full name</span><input className="form-control" value={form.fullName} onChange={event => update('fullName', event.target.value)} required maxLength={120}/></label><label className="form-field"><span>Phone number</span><input className="form-control" value={form.phone} onChange={event => update('phone', event.target.value)} required maxLength={40}/></label><label className="form-field profile-editor-full"><span>Primary address</span><input className="form-control" value={form.address} onChange={event => update('address', event.target.value)} maxLength={240}/></label><label className="form-field profile-editor-full"><span>{isDriver ? 'Service zones' : 'Service area or preferred zones'}</span><input className="form-control" value={form.serviceZones} onChange={event => update('serviceZones', event.target.value)} placeholder="Separate areas with commas" maxLength={400}/></label>{(isDriver || isProcessor) && <label className="form-field profile-editor-full"><span>Availability and operating hours</span><input className="form-control" value={form.availability} onChange={event => update('availability', event.target.value)} placeholder="Mon–Sat, 8:00 AM–6:00 PM" maxLength={160}/></label>}{isDriver && <label className="form-field profile-editor-full"><span>Vehicle details</span><input className="form-control" value={form.vehicleDetails} onChange={event => update('vehicleDetails', event.target.value)} maxLength={160}/></label>}</div>{error && <div className="field-error">{error}</div>}<footer className="profile-editor-actions"><Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving || loading}><Save size={14}/>{saving ? 'Saving…' : 'Save profile'}</Button></footer></form>}</section></div>;
}

export default function ProfileEditor(props: { onClose: () => void; onSaved: (profile: ProfileData) => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted ? createPortal(<ProfileEditorContent {...props} />, document.body) : null;
}

export type { ProfileData };
