'use client';

import { useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { supabase, isPersistenceConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(''); const [error, setError] = useState(''); const [sent, setSent] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setError(''); if (!supabase || !isPersistenceConfigured) { setError('Password recovery is temporarily unavailable.'); return; } const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }); if (resetError) { setError(resetError.message); return; } setSent(true); }
  return <main className="login-shell"><section className="login-card"><div className="brand"><div className="brand-mark">RL</div><div><div className="brand-name">RinseLine</div><div className="brand-sub">Account recovery</div></div></div><h1>Reset your password</h1><p>Enter your email and we’ll send a secure password-reset link.</p>{sent ? <div style={{ color: 'var(--green)', fontSize: 13, lineHeight: 1.6 }}><CheckCircle2 size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />If an account exists for this address, a password-reset email has been sent.</div> : <form className="login-form" onSubmit={submit}><div className="form-field"><label>Email address</label><input className="form-control" type="email" required value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" /></div>{error && <span className="field-error">{error}</span>}<Button type="submit" style={{ justifyContent: 'center' }}>Send reset link <ArrowRight size={15} /></Button></form>}<p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}><a href="/login" style={{ color: 'var(--teal)', fontWeight: 700 }}>Return to sign in</a></p></section></main>;
}
