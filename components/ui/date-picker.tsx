'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  'aria-label'?: string;
};

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fromIso(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day)
    ? new Date(year, month - 1, day)
    : new Date();
}

function toIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function displayDate(value: string) {
  if (!value) return 'Select date';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(fromIso(value));
}

/**
 * A calendar that is rendered in a portal and positioned with fixed viewport
 * coordinates. This avoids browser-native date picker placement bugs inside
 * scrolling application layouts.
 */
export function DatePicker({ value, onChange, id, className = '', disabled, min, max, 'aria-label': ariaLabel }: DatePickerProps) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => fromIso(value));
  const [position, setPosition] = useState({ top: 0, left: 0, placement: 'bottom' as 'top' | 'bottom' });

  function place() {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const calendarWidth = 290;
    const calendarHeight = 330;
    const gap = 8;
    const showAbove = window.innerHeight - rect.bottom < calendarHeight + gap && rect.top > calendarHeight + gap;
    setPosition({
      top: showAbove ? Math.max(8, rect.top - calendarHeight - gap) : Math.min(window.innerHeight - calendarHeight - 8, rect.bottom + gap),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - calendarWidth - 8)),
      placement: showAbove ? 'top' : 'bottom',
    });
  }

  function toggle() {
    if (disabled) return;
    if (!open) {
      setMonth(fromIso(value));
      requestAnimationFrame(place);
    }
    setOpen(current => !current);
  }

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !popover.current?.contains(target)) setOpen(false);
    };
    const reposition = () => place();
    window.addEventListener('mousedown', dismiss);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('mousedown', dismiss);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const dates = Array.from({ length: firstDay + days }, (_, index) => index < firstDay ? null : new Date(month.getFullYear(), month.getMonth(), index - firstDay + 1));
  const selected = value || '';

  return <div className={`date-picker ${className}`} ref={root}>
    <button ref={trigger} id={id} type="button" className="form-control date-picker-trigger" aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={toggle}>
      <CalendarDays size={15} aria-hidden="true" />
      <span>{displayDate(value)}</span>
    </button>
    {open && typeof document !== 'undefined' && createPortal(
      <section ref={popover} className={`date-picker-popover date-picker-popover--${position.placement}`} style={{ top: position.top, left: position.left }} role="dialog" aria-label="Choose a date">
        <header className="date-picker-header">
          <button type="button" className="date-picker-nav" aria-label="Previous month" onClick={() => setMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
          <strong>{new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month)}</strong>
          <button type="button" className="date-picker-nav" aria-label="Next month" onClick={() => setMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
        </header>
        <div className="date-picker-grid date-picker-weekdays">{weekdayLabels.map(day => <span key={day}>{day}</span>)}</div>
        <div className="date-picker-grid date-picker-days">{dates.map((date, index) => {
          if (!date) return <span key={`blank-${index}`} />;
          const iso = toIso(date);
          const unavailable = Boolean((min && iso < min) || (max && iso > max));
          return <button key={iso} type="button" disabled={unavailable} className={iso === selected ? 'selected' : ''} onClick={() => { onChange(iso); setOpen(false); }}>{date.getDate()}</button>;
        })}</div>
      </section>,
      document.body,
    )}
  </div>;
}
