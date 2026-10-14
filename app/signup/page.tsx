'use client';

import { useState } from 'react';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { supabase, isPersistenceConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2 || !email.includes('@') || password.length < 4) { setError('Enter your name, a valid work email, and a password of at least 4 characters.'); return; }
    if (isPersistenceConfigured && supabase) {
      const result = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
      if (result.error) { setError(result.error.message); return; }
      if (!result.data.session) { setSuccess('Account created. Check your email to verify the account, then sign in.'); return; }
    }
    localStorage.setItem('rinseline-session', JSON.stringify({ name, email }));
    window.location.href = '/';
  }
  return <main className="login-shell"><section className="login-card">
    <div className="brand"><div className="brand-mark">RL</div><div><div className="brand-name">RinseLine</div><div className="brand-sub">Dispatch control</div></div></div>
    <h1>Create your workspace</h1><p>Set up a lightweight operations account for your dispatch team.</p>
    <form className="login-form" onSubmit={submit}>
      <div className="form-field"><label htmlFor="name">Full name</label><input id="name" className="form-control" placeholder="Jordan Davis" value={name} onChange={e=>setName(e.target.value)}/></div>
      <div className="form-field"><label htmlFor="email">Work email</label><input id="email" className="form-control" type="email" placeholder="ops@rinseline.co" value={email} onChange={e=>setEmail(e.target.value)}/></div>
      <div className="form-field"><label htmlFor="password">Password</label><input id="password" className="form-control" type="password" placeholder="Create a password" value={password} onChange={e=>setPassword(e.target.value)}/></div>
      {error&&<span className="field-error">{error}</span>}{success&&<span style={{color:'var(--green)',fontSize:11,lineHeight:1.5}}>{success}</span>}
      <Button type="submit" style={{justifyContent:'center'}}>Create account <ArrowRight size={15}/></Button>
    </form>
    <p className="login-note"><LockKeyhole size={13} style={{verticalAlign:'-2px',marginRight:4}}/> Account provisioning is intentionally minimal here; connect Supabase Auth before production launch.</p>
    <p style={{textAlign:'center',fontSize:12,color:'var(--muted)'}}>Already have access? <a href="/login" style={{color:'var(--teal)',fontWeight:700}}>Sign in</a></p>
  </section></main>;
}
