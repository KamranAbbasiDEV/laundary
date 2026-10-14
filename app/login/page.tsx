'use client';

import { useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { supabase, isPersistenceConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (!isPersistenceConfigured || !supabase) { setError('Sign in is temporarily unavailable. Please try again later.'); return; }
    if (!email || password.length < 8) { setError('Enter your email and password.'); return; }
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) { setError('We could not sign you in with those details.'); return; }
    window.location.href = '/';
  }
  return <main className="login-shell"><section className="login-card">
    <div className="brand"><div className="brand-mark">RL</div><div><div className="brand-name">RinseLine</div><div className="brand-sub">Laundry delivery, coordinated</div></div></div>
    <h1>Welcome back</h1><p>Sign in to manage pickups, processing, routes, and deliveries.</p>
    <form className="login-form" onSubmit={submit}>
      <div className="form-field"><label htmlFor="email">Email address</label><input id="email" className="form-control" type="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" /></div>
      <div className="form-field"><label htmlFor="password">Password</label><input id="password" className="form-control" type="password" placeholder="Enter your password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" /></div>
      {error && <span className="field-error">{error}</span>}
      <Button type="submit" style={{ justifyContent: 'center' }}>Sign in <ArrowRight size={15} /></Button>
    </form>
    <p className="login-note"><ShieldCheck size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />Your workspace access is based on your approved account role.</p>
    <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>Need a customer account? <a href="/signup" style={{ color: 'var(--teal)', fontWeight: 700 }}>Create one</a></p>
  </section></main>;
}
