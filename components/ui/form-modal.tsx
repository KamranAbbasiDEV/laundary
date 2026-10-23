'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

type FormModalProps = {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  labelledBy?: string;
};

export function FormModal({ title, description, onClose, children, footer, labelledBy = 'form-modal-title' }: FormModalProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal form-modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <header className="modal-header">
        <div><h2 id={labelledBy}>{title}</h2>{description && <p>{description}</p>}</div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={16}/></button>
      </header>
      {children}
      <footer className="modal-footer">{footer}</footer>
    </section>
  </div>;
}
