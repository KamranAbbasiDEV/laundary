'use client';

import { useState } from 'react';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { supabase, isPersistenceConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState('');
  async function submit(e:React.FormEvent) { e.preventDefault(); setError(''); if(!isPersistenceConfigured||!supabase){setError('Authentication is not configured. Add the Supabase environment variables before signing in.');return;} if(!email||password.length<8){setError('Enter your work email and an 8-character minimum password.');return;} const result=await supabase.auth.signInWithPassword({email,password}); if(result.error){setError(result.error.message);return;} window.location.href='/'; }
  return <main className="login-shell"><section className="login-card"><div className="brand"><div className="brand-mark">RL</div><div><div className="brand-name">RinseLine</div><div className="brand-sub">Dispatch control</div></div></div><h1>Welcome back</h1><p>Sign in to coordinate pickups, processor capacity, routes, and delivery exceptions.</p><form className="login-form" onSubmit={submit}><div className="form-field"><label htmlFor="email">Work email</label><input id="email" className="form-control" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" /></div><div className="form-field"><label htmlFor="password">Password</label><input id="password" className="form-control" type="password" placeholder="Enter your password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" /></div>{error&&<span className="field-error">{error}</span>}<Button type="submit" style={{justifyContent:'center'}}>Sign in <ArrowRight size={15}/></Button></form><p className="login-note"><LockKeyhole size={13} style={{verticalAlign:'-2px',marginRight:4}}/> Access is managed through Supabase Auth and workspace roles.</p><p style={{textAlign:'center',fontSize:12,color:'var(--muted)'}}>Need an account? <a href="/signup" style={{color:'var(--teal)',fontWeight:700}}>Request access</a></p></section></main>;
}
