'use client';

import { useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { supabase, isPersistenceConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setSuccess('');
    if (!isPersistenceConfigured || !supabase) { setError('Account creation is temporarily unavailable. Please try again later.'); return; }
    if (name.trim().length < 2 || !email.includes('@') || password.length < 8) { setError('Enter your name, a valid email, and a password of at least 8 characters.'); return; }
    const result = await supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim() } } });
    if (result.error) { setError(result.error.message); return; }
    if (!result.data.session) { setSuccess('Account created. Check your inbox to verify your email, then sign in.'); return; }
    window.location.href = '/';
  }

  return <main className="login-shell"><section className="login-card">
    <div className="brand"><div className="brand-mark">RL</div><div><div className="brand-name">RinseLine</div><div className="brand-sub">Laundry delivery, coordinated</div></div></div>
    <h1>Create your account</h1><p>Set up a customer account to schedule pickups, manage preferences, and follow every order.</p>
    <form className="login-form" onSubmit={submit}>
      <div className="form-field"><label htmlFor="name">Full name</label><input id="name" className="form-control" placeholder="Your full name" value={name} onChange={event => setName(event.target.value)} autoComplete="name" /></div>
      <div className="form-field"><label htmlFor="email">Email address</label><input id="email" className="form-control" type="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" /></div>
      <div className="form-field"><label htmlFor="password">Password</label><input id="password" className="form-control" type="password" placeholder="At least 8 characters" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" /></div>
      {error && <span className="field-error">{error}</span>}{success && <span style={{ color: 'var(--green)', fontSize: 11, lineHeight: 1.5 }}><CheckCircle2 size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />{success}</span>}
      <Button type="submit" style={{ justifyContent: 'center' }}>Create account <ArrowRight size={15} /></Button>
    </form>
    <p className="login-note">Customer accounts are created here. Team members join by invitation from a workspace owner.</p>
    <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>Running a laundry facility? <a href="/apply/processor" style={{ color: 'var(--teal)', fontWeight: 700 }}>Apply as a processor</a></p>
    <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>Already have an account? <a href="/login" style={{ color: 'var(--teal)', fontWeight: 700 }}>Sign in</a></p>
  </section></main>;
}
