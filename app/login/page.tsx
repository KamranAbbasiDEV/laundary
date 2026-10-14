'use client';

import { useState } from 'react';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { supabase, isPersistenceConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const [email, setEmail] = useState('ops@rinseline.co');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || password.length < 4) { setError('Enter a valid email and password to continue.'); return; }
    if (isPersistenceConfigured && supabase) {
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) { setError(result.error.message); return; }
    }
    localStorage.setItem('rinseline-session', JSON.stringify({ email }));
    window.location.href = '/';
  }
  return <main className="login-shell"><section className="login-card">
    <div className="brand"><div className="brand-mark">RL</div><div><div className="brand-name">RinseLine</div><div className="brand-sub">Dispatch control</div></div></div>
    <h1>Welcome back</h1><p>Sign in to coordinate pickups, processor capacity, routes, and delivery exceptions.</p>
    <form className="login-form" onSubmit={submit}>
      <div className="form-field"><label htmlFor="email">Work email</label><input id="email" className="form-control" type="email" value={email} onChange={e=>setEmail(e.target.value)} /></div>
      <div className="form-field"><label htmlFor="password">Password</label><input id="password" className="form-control" type="password" placeholder="Enter your password" value={password} onChange={e=>setPassword(e.target.value)} /></div>
      {error && <span className="field-error">{error}</span>}
      <Button type="submit" style={{justifyContent:'center'}}>Sign in <ArrowRight size={15}/></Button>
    </form>
    <p className="login-note"><LockKeyhole size={13} style={{verticalAlign:'-2px',marginRight:4}}/> Minimal access flow for the operations workspace. Supabase Auth can replace this local session at deployment.</p>
    <p style={{textAlign:'center',fontSize:12,color:'var(--muted)'}}>New workspace? <a href="/signup" style={{color:'var(--teal)',fontWeight:700}}>Create an account</a></p>
  </section></main>;
}
