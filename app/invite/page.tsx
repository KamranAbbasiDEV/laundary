'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, MailCheck } from 'lucide-react';
import { supabase, isPersistenceConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

type InviteState = 'checking' | 'ready' | 'missing';

export default function InvitePage() {
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [inviteState, setInviteState] = useState<InviteState>('checking');
  const [confirmationUrl, setConfirmationUrl] = useState<string | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client || !isPersistenceConfigured) { setInviteState('missing'); return; }
    let active = true;
    const url = new URL(window.location.href);
    const protectedConfirmationUrl = url.searchParams.get('confirmation_url');
    if (protectedConfirmationUrl) {
      try {
        const destination = new URL(protectedConfirmationUrl);
        if (!destination.pathname.includes('/auth/v1/verify')) throw new Error('Invalid confirmation URL');
        setConfirmationUrl(destination.toString());
        setInviteState('ready');
      } catch { setError('This invitation link is invalid. Ask the workspace owner to send a new invitation.'); setInviteState('missing'); }
      return;
    }

    const establishSession = async () => {
      const code = url.searchParams.get('code');
      if (code) {
        const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
        if (exchangeError) { if (active) { setError('This invitation link has expired or was already used. Ask the workspace owner to send a new invitation.'); setInviteState('missing'); } return; }
        url.searchParams.delete('code');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      }
      const { data: { session } } = await client.auth.getSession();
      if (active && session) setInviteState('ready');
    };

    void establishSession();
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => { if (active && session) setInviteState('ready'); });
    const timeout = window.setTimeout(() => { if (active) setInviteState(current => current === 'checking' ? 'missing' : current); }, 5000);
    return () => { active = false; subscription.unsubscribe(); window.clearTimeout(timeout); };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!supabase || !isPersistenceConfigured || inviteState !== 'ready') { setError('This secure invitation session is not ready. Reopen the invitation email and try again.'); return; }
    if (password.length < 8 || name.trim().length < 2) { setError('Enter your name and a password of at least 8 characters.'); return; }
    const result = await supabase.auth.updateUser({ password, data: { full_name: name.trim() } });
    if (result.error) { setError(result.error.message || 'Unable to complete account setup. Reopen the invitation email and try again.'); return; }
    setSuccess(true);
  }

  if (confirmationUrl) return <main className="login-shell"><section className="login-card"><div className="brand"><div className="brand-mark">RL</div><div><div className="brand-name">RinseLine</div><div className="brand-sub">Team workspace</div></div></div><MailCheck size={34} color="var(--teal)"/><h1>Ready to accept your invitation</h1><p>Continue to securely verify this invitation and set up your account.</p><Button onClick={() => window.location.assign(confirmationUrl)} style={{ justifyContent: 'center' }}>Accept invitation <ArrowRight size={15} /></Button></section></main>;
  if (success) return <main className="login-shell"><section className="login-card"><div className="brand"><div className="brand-mark">RL</div><div><div className="brand-name">RinseLine</div><div className="brand-sub">Team workspace</div></div></div><CheckCircle2 size={34} color="var(--green)"/><h1>Account ready</h1><p>Your account has been set up. You can now complete your role profile.</p><Button onClick={() => window.location.href = '/onboarding'} style={{ justifyContent: 'center' }}>Continue setup <ArrowRight size={15}/></Button></section></main>;
  if (inviteState === 'checking') return <main className="login-shell"><section className="login-card"><div className="brand"><div className="brand-mark">RL</div><div><div className="brand-name">RinseLine</div><div className="brand-sub">Team workspace</div></div></div><h1>Preparing your invitation</h1><p>Securely confirming your invitation session.</p></section></main>;
  if (inviteState === 'missing') return <main className="login-shell"><section className="login-card"><div className="brand"><div className="brand-mark">RL</div><div><div className="brand-name">RinseLine</div><div className="brand-sub">Team workspace</div></div></div><h1>Invitation link needed</h1><p>{error || 'Open the original invitation email and use its secure link to start account setup.'}</p><p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}><a href="/login" style={{ color: 'var(--teal)', fontWeight: 700 }}>Return to sign in</a></p></section></main>;
  return <main className="login-shell"><section className="login-card"><div className="brand"><div className="brand-mark">RL</div><div><div className="brand-name">RinseLine</div><div className="brand-sub">Team workspace</div></div></div><h1>Accept your invitation</h1><p>Complete your account setup to join the RinseLine team.</p><form className="login-form" onSubmit={submit}><div className="form-field"><label>Full name</label><input className="form-control" required value={name} onChange={event => setName(event.target.value)} autoComplete="name" /></div><div className="form-field"><label>Create password</label><input className="form-control" type="password" required value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" placeholder="At least 8 characters" /></div>{error && <span className="field-error">{error}</span>}<Button type="submit" style={{ justifyContent: 'center' }}>Finish setup <ArrowRight size={15}/></Button></form></section></main>;
}
