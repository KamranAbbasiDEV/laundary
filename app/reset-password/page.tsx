'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { supabase, isPersistenceConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

type RecoveryState = 'checking' | 'ready' | 'invalid';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [recoveryState, setRecoveryState] = useState<RecoveryState>('checking');

  useEffect(() => {
    const client = supabase;
    if (!client || !isPersistenceConfigured) { setRecoveryState('invalid'); return; }
    let active = true;
    const url = new URL(window.location.href);

    const establishRecovery = async () => {
      const code = url.searchParams.get('code');
      if (code) {
        const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (active) { setError('This password setup link is invalid or expired. Ask the workspace owner to resend setup.'); setRecoveryState('invalid'); }
          return;
        }
        url.searchParams.delete('code');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      }
      const { data: { session } } = await client.auth.getSession();
      if (active && session) setRecoveryState('ready');
    };

    void establishRecovery();
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (active && event === 'PASSWORD_RECOVERY' && session) setRecoveryState('ready');
    });
    const timeout = window.setTimeout(() => {
      if (active) setRecoveryState(current => current === 'checking' ? 'invalid' : current);
    }, 5000);
    return () => { active = false; subscription.unsubscribe(); window.clearTimeout(timeout); };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!supabase || !isPersistenceConfigured || recoveryState !== 'ready') { setError('Open the password setup link from your most recent email.'); return; }
    if (password.length < 8) { setError('Use a password of at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) { setError('This password setup link is invalid or expired. Ask the workspace owner to resend setup.'); return; }
    setSaved(true);
  }

  const brand = <div className="brand"><div className="brand-mark">RL</div><div><div className="brand-name">RinseLine</div><div className="brand-sub">Account setup</div></div></div>;
  if (saved) return <main className="login-shell"><section className="login-card">{brand}<CheckCircle2 size={34} color="var(--green)" /><h1>Password saved</h1><p>Continue to complete your profile before entering the workspace.</p><Button onClick={() => { window.location.href = '/onboarding'; }} style={{ justifyContent: 'center' }}>Continue setup <ArrowRight size={15} /></Button></section></main>;
  if (recoveryState === 'checking') return <main className="login-shell"><section className="login-card">{brand}<h1>Preparing account setup</h1><p>Securely confirming your password setup link.</p></section></main>;
  if (recoveryState === 'invalid') return <main className="login-shell"><section className="login-card">{brand}<h1>Setup link needed</h1><p>{error || 'Open the password setup link from your most recent email.'}</p><p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}><a href="/login" style={{ color: 'var(--teal)', fontWeight: 700 }}>Return to sign in</a></p></section></main>;
  return <main className="login-shell"><section className="login-card">{brand}<h1>Choose a password</h1><p>Create your password, then finish your workspace profile.</p><form className="login-form" onSubmit={submit}><div className="form-field"><label>New password</label><input className="form-control" type="password" required value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" /></div><div className="form-field"><label>Confirm password</label><input className="form-control" type="password" required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" /></div>{error && <span className="field-error">{error}</span>}<Button type="submit" style={{ justifyContent: 'center' }}>Save and continue <ArrowRight size={15} /></Button></form></section></main>;
}
