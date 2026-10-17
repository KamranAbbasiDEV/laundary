'use client';

import { useEffect, useState } from 'react';
import { Bell, Save } from 'lucide-react';
import { Button } from './ui/button';

type Preferences = { in_app_enabled: boolean; sms_enabled: boolean; processor_offer_sms: boolean; route_update_sms: boolean };
const defaults: Preferences = { in_app_enabled: true, sms_enabled: true, processor_offer_sms: true, route_update_sms: true };

export default function NotificationPreferencesPanel({ notify }: { notify: (message: string) => void }) {
  const [preferences, setPreferences] = useState(defaults); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => { void fetch('/api/notification-preferences').then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to load notification preferences'); setPreferences({ ...defaults, ...body.preferences }); }).catch(value => setError(value instanceof Error ? value.message : 'Unable to load notification preferences')).finally(() => setLoading(false)); }, []);
  async function save() { setSaving(true); setError(''); try { const response = await fetch('/api/notification-preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inAppEnabled: preferences.in_app_enabled, smsEnabled: preferences.sms_enabled, processorOfferSms: preferences.processor_offer_sms, routeUpdateSms: preferences.route_update_sms }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to save notification preferences'); setPreferences({ ...defaults, ...body.preferences }); notify('Notification preferences saved'); } catch (value) { setError(value instanceof Error ? value.message : 'Unable to save notification preferences'); } finally { setSaving(false); } }
  if (loading) return <section className="panel"><div className="panel-body">Loading notification preferences…</div></section>;
  const toggle = (key: keyof Preferences, label: string, description: string) => <label className="form-field" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10 }}><input type="checkbox" checked={preferences[key]} onChange={event => setPreferences(current => ({ ...current, [key]: event.target.checked }))} /><span><strong>{label}</strong><small style={{ display: 'block', color: 'var(--muted)' }}>{description}</small></span></label>;
  return <section className="panel" style={{ marginTop: 18 }}><div className="panel-heading"><div><h2><Bell size={17} /> Notification preferences</h2><p>Choose which operational alerts this account receives.</p></div><Button onClick={() => void save()} disabled={saving}><Save size={15} />{saving ? 'Saving…' : 'Save preferences'}</Button></div><div className="panel-body form-grid">{error && <div className="field-error full">{error}</div>}{toggle('in_app_enabled', 'In-app notifications', 'Show alerts in the notification center.')}{toggle('sms_enabled', 'SMS notifications', 'Allow operational SMS messages.')}{toggle('processor_offer_sms', 'Processor offer SMS', 'Notify processors when capacity is requested.')}{toggle('route_update_sms', 'Route update SMS', 'Notify drivers about route changes.')}</div></section>;
}
