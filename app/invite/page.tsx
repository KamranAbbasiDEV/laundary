'use client';

import { useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { supabase, isPersistenceConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

export default function InvitePage() {
  const [password, setPassword] = useState(''); const [name, setName] = useState(''); const [error, setError] = useState(''); const [success, setSuccess] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setError(''); if (!supabase || !isPersistenceConfigured) { setError('This invitation cannot be completed right now.'); return; } if (password.length < 8 || name.trim().length < 2) { setError('Enter your name and a password of at least 8 characters.'); return; } const result = await supabase.auth.updateUser({ password, data: { full_name: name.trim() } }); if (result.error) { setError('This invitation is no longer valid. Ask the workspace owner to send a new one.'); return; } window.location.href = '/onboarding'; }
  if (success) return <main className="login-shell"><section className="login-card"><div className="brand"><div className="brand-mark">RL</div><div><div className="brand-name">RinseLine</div><div className="brand-sub">Team workspace</div></div></div><CheckCircle2 size={34} color="var(--green)"/><h1>Account ready</h1><p>Your account has been set up. You can now complete your role profile.</p><Button onClick={() => window.location.href = '/onboarding'} style={{ justifyContent: 'center' }}>Continue setup <ArrowRight size={15}/></Button></section></main>;
  return <main className="login-shell"><section className="login-card"><div className="brand"><div className="brand-mark">RL</div><div><div className="brand-name">RinseLine</div><div className="brand-sub">Team workspace</div></div></div><h1>Accept your invitation</h1><p>Complete your account setup to join the RinseLine team.</p><form className="login-form" onSubmit={submit}><div className="form-field"><label>Full name</label><input className="form-control" required value={name} onChange={event => setName(event.target.value)} autoComplete="name" /></div><div className="form-field"><label>Create password</label><input className="form-control" type="password" required value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" placeholder="At least 8 characters" /></div>{error && <span className="field-error">{error}</span>}<Button type="submit" style={{ justifyContent: 'center' }}>Finish setup <ArrowRight size={15}/></Button></form></section></main>;
}
