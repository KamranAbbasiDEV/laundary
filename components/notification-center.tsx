'use client';

import { Bell, CheckCheck, Inbox, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type Notice = { id: string; event: string; message: string; status: string; created_at: string };
export default function NotificationCenter() {
  const [open, setOpen] = useState(false); const [items, setItems] = useState<Notice[]>([]); const [seen, setSeen] = useState<string[]>([]); const [enabled, setEnabled] = useState(false); const root = useRef<HTMLDivElement>(null);
  const load = async () => { const response = await fetch('/api/notifications', { cache: 'no-store' }); if (response.ok) { const body = await response.json(); setItems(body.notifications ?? []); } };
  useEffect(() => { const authPage = ['/login', '/signup', '/invite', '/forgot-password', '/reset-password', '/onboarding', '/apply/processor'].includes(window.location.pathname); setEnabled(!authPage); if (authPage) return; void load(); const id = window.setInterval(() => void load(), 30000); return () => window.clearInterval(id); }, []);
  useEffect(() => { const close = (event: MouseEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); }; document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close); }, []);
  const unread = items.filter(item => !seen.includes(item.id)).length;
  if (!enabled) return null;
  return <div className="notification-center" ref={root}><button className="icon-button notification-trigger" title="Notifications" onClick={() => { setOpen(value => !value); setSeen(items.map(item => item.id)); }}><Bell size={16}/>{unread > 0 && <span className="notification-badge">{unread > 9 ? '9+' : unread}</span>}</button>{open && <section className="notification-popover"><header><div><strong>Notifications</strong><span>Operational activity</span></div><button className="icon-button" title="Close notifications" onClick={() => setOpen(false)}><X size={15}/></button></header><div className="notification-list">{items.length ? items.map(item => <article className="notification-item" key={item.id}><div className="notification-dot"/><div><strong>{item.event.replaceAll('_', ' ')}</strong><p>{item.message}</p><time>{new Date(item.created_at).toLocaleString()}</time></div></article>) : <div className="notification-empty"><Inbox size={18}/><span>No operational notifications yet.</span></div>}</div>{items.length > 0 && <footer><button className="button button-quiet" onClick={() => setSeen(items.map(item => item.id))}><CheckCheck size={14}/> Mark all read</button></footer>}</section>}</div>;
}
