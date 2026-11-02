'use client';

import { useEffect, useState } from 'react';

export function BrandLockup({ subtitle, compact = false }: { subtitle: string; compact?: boolean }) {
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/workspace-public', { cache: 'no-store' });
        const body = await response.json();
        if (active && response.ok && typeof body.companyName === 'string' && body.companyName.trim()) setCompanyName(body.companyName.trim());
        else if (active) setCompanyName('RinseLine');
      } catch { if (active) setCompanyName('RinseLine'); }
    };
    void load();
    const listener = (event: Event) => {
      const name = (event as CustomEvent<string>).detail;
      if (typeof name === 'string' && name.trim()) setCompanyName(name.trim());
    };
    window.addEventListener('workspace-branding-updated', listener);
    return () => { active = false; window.removeEventListener('workspace-branding-updated', listener); };
  }, []);
  const initials = (companyName ?? 'RL').split(/\s+/).map(word => word[0]).join('').slice(0, 2).toUpperCase();
  return <div className={`brand ${compact ? 'brand-compact' : ''}`} aria-label={companyName ?? 'Workspace'}><div className="brand-mark">{logoFailed ? <span className="brand-mark-fallback">{initials}</span> : <img src="/brand/client-logo.png" alt="" onError={() => setLogoFailed(true)} />}</div>{!compact && <div><div className={`brand-name ${companyName ? '' : 'brand-name-loading'}`}>{companyName ?? 'Workspace'}</div><div className="brand-sub">{subtitle}</div></div>}</div>;
}
