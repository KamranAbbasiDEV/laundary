'use client';

import { useEffect, useState } from 'react';

export function BrandLockup({ subtitle }: { subtitle: string }) {
  const [companyName, setCompanyName] = useState('RinseLine');
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/workspace-public', { cache: 'no-store' });
        const body = await response.json();
        if (active && response.ok && typeof body.companyName === 'string' && body.companyName.trim()) setCompanyName(body.companyName.trim());
      } catch { /* Preserve the reliable default branding if the configuration request is unavailable. */ }
    };
    void load();
    const listener = (event: Event) => {
      const name = (event as CustomEvent<string>).detail;
      if (typeof name === 'string' && name.trim()) setCompanyName(name.trim());
    };
    window.addEventListener('workspace-branding-updated', listener);
    return () => { active = false; window.removeEventListener('workspace-branding-updated', listener); };
  }, []);
  return <div className="brand"><div className="brand-mark">{companyName.slice(0, 2).toUpperCase()}</div><div><div className="brand-name">{companyName}</div><div className="brand-sub">{subtitle}</div></div></div>;
}
