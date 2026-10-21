'use client';

import { ChevronLeft, ChevronRight, CalendarDays, Clock3, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';

type Props = { value: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; type?: 'date' | 'datetime-local'; min?: string; max?: string; disabled?: boolean; 'aria-label'?: string };
type PickupWindowProps = { startValue: string; endValue: string; onStartChange: (value: string) => void; onEndChange: (value: string) => void; disabled?: boolean; 'aria-label'?: string };
const pad = (value: number) => String(value).padStart(2, '0');
const dateKey = (date: Date) => date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
const parseDate = (value: string) => { const date = new Date(value.length === 10 ? value + 'T00:00:00' : value); return Number.isNaN(date.getTime()) ? new Date() : date; };
const monthLabel = (date: Date) => new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
const displayValue = (value: string, type: Props['type']) => { if (!value) return type === 'datetime-local' ? 'Choose date and time' : 'Choose a date'; const date = parseDate(value); return new Intl.DateTimeFormat(undefined, type === 'datetime-local' ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(date); };

export function DateField({ value, onChange, type = 'date', min, max, disabled, 'aria-label': ariaLabel }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [opensUp, setOpensUp] = useState(false);
  const [month, setMonth] = useState(() => { const date = parseDate(value); return new Date(date.getFullYear(), date.getMonth(), 1); });
  useEffect(() => { if (value) { const date = parseDate(value); setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); } }, [value]);
  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('mousedown', closeOnOutsideClick); document.removeEventListener('keydown', closeOnEscape); };
  }, [open]);
  useEffect(() => {
    if (!open || !rootRef.current) return;
    const bounds = rootRef.current.getBoundingClientRect();
    const estimatedHeight = type === 'datetime-local' ? 360 : 300;
    setOpensUp(bounds.bottom + estimatedHeight > window.innerHeight && bounds.top > estimatedHeight);
  }, [open, type]);
  const days = useMemo(() => { const first = new Date(month.getFullYear(), month.getMonth(), 1); const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(); const leading = (first.getDay() + 6) % 7; return [...Array(leading).fill(null), ...Array.from({ length: count }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1))]; }, [month]);
  const setNativeValue = (next: string) => { const input = inputRef.current; if (!input) return; const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set; setter?.call(input, next); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); };
  const selectDate = (date: Date) => { const current = value && value.length > 10 ? value.slice(11) : '09:00'; setNativeValue(type === 'datetime-local' ? dateKey(date) + 'T' + current : dateKey(date)); if (type === 'date') setOpen(false); };
  const selectToday = () => selectDate(new Date());
  const date = value ? parseDate(value) : null;
  const minKey = min?.slice(0, 10); const maxKey = max?.slice(0, 10);
  return <div className="date-field" ref={rootRef}><button type="button" className="date-field-trigger" onClick={() => !disabled && setOpen(current => !current)} disabled={disabled} aria-label={ariaLabel || displayValue(value, type)}><span className="date-field-icon">{type === 'datetime-local' ? <Clock3 size={15} /> : <CalendarDays size={15} />}</span><span>{displayValue(value, type)}</span>{value && <span className="date-field-clear" role="button" aria-label="Clear date" onClick={event => { event.stopPropagation(); setNativeValue(''); setOpen(false); }}><X size={14} /></span>}</button>{open && <div className={`date-popover${opensUp ? ' opens-up' : ''}`}><div className="date-popover-header"><button type="button" className="icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={15} /></button><strong>{monthLabel(month)}</strong><button type="button" className="icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={15} /></button></div><div className="date-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}</div><div className="date-grid">{days.map((item, index) => item ? <button type="button" className={'date-day ' + (date && dateKey(date) === dateKey(item) ? 'selected ' : '') + (dateKey(item) === dateKey(new Date()) ? 'today' : '')} key={dateKey(item)} disabled={Boolean((minKey && dateKey(item) < minKey) || (maxKey && dateKey(item) > maxKey))} onClick={() => selectDate(item)}>{item.getDate()}</button> : <span key={'empty-' + index} />)}</div>{type === 'datetime-local' && <label className="date-time-field"><Clock3 size={14} /><span>Time</span><input type="time" value={value.slice(11) || '09:00'} onChange={event => { setNativeValue(value.slice(0, 10) + 'T' + event.target.value); setOpen(false); }} /></label>}<div className="date-popover-footer"><button type="button" className="button button-quiet" onClick={selectToday}>Today</button>{value && <button type="button" className="button button-quiet" onClick={() => { setNativeValue(''); setOpen(false); }}>Clear</button>}</div></div>}<input ref={inputRef} className="date-field-native" type={type} value={value} min={min} max={max} disabled={disabled} onChange={onChange} aria-hidden="true" tabIndex={-1} readOnly /></div>;
}

export function PickupWindowField({ startValue, endValue, onStartChange, onEndChange, disabled, 'aria-label': ariaLabel }: PickupWindowProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [opensUp, setOpensUp] = useState(false);
  const [activePart, setActivePart] = useState<'start' | 'end'>('start');
  const [month, setMonth] = useState(() => { const date = parseDate(startValue || endValue); return new Date(date.getFullYear(), date.getMonth(), 1); });
  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('mousedown', closeOnOutsideClick); document.removeEventListener('keydown', closeOnEscape); };
  }, [open]);
  useEffect(() => {
    if (!open || !rootRef.current) return;
    const bounds = rootRef.current.getBoundingClientRect();
    const estimatedHeight = 385;
    setOpensUp(bounds.bottom + estimatedHeight > window.innerHeight && bounds.top > estimatedHeight);
  }, [open]);
  useEffect(() => {
    const date = parseDate(startValue || endValue);
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }, [startValue, endValue]);
  const days = useMemo(() => { const first = new Date(month.getFullYear(), month.getMonth(), 1); const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(); const leading = (first.getDay() + 6) % 7; return [...Array(leading).fill(null), ...Array.from({ length: count }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1))]; }, [month]);
  const activeValue = activePart === 'start' ? startValue : endValue;
  const startDate = startValue ? parseDate(startValue) : null;
  const endDate = endValue ? parseDate(endValue) : null;
  const formatPart = (value: string) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(parseDate(value)) : 'Choose date and time';
  const setPartValue = (part: 'start' | 'end', date: Date, time?: string) => {
    const nextTime = time || (part === 'start' ? startValue : endValue).slice(11) || (part === 'start' ? '09:00' : '10:00');
    const next = `${dateKey(date)}T${nextTime}`;
    if (part === 'start') onStartChange(next); else onEndChange(next);
  };
  const selectDate = (date: Date) => { setPartValue(activePart, date); if (activePart === 'start') setActivePart('end'); };
  const setTime = (part: 'start' | 'end', time: string) => { const value = part === 'start' ? startValue : endValue; const date = parseDate(value || new Date().toISOString()); setPartValue(part, date, time); };
  const clear = () => { onStartChange(''); onEndChange(''); setOpen(false); setActivePart('start'); };
  const label = startValue && endValue ? `${formatPart(startValue)} → ${formatPart(endValue)}` : startValue ? `${formatPart(startValue)} → Choose end` : 'Choose pickup window';
  return <div className="date-field pickup-window-field" ref={rootRef}>
    <button type="button" className="date-field-trigger" onClick={() => !disabled && setOpen(current => !current)} disabled={disabled} aria-label={ariaLabel || label}>
      <span className="date-field-icon"><Clock3 size={15} /></span><span className="pickup-window-label">{label}</span>{(startValue || endValue) && <span className="date-field-clear" role="button" aria-label="Clear pickup window" onClick={event => { event.stopPropagation(); clear(); }}><X size={14} /></span>}
    </button>
    {open && <div className={`date-popover pickup-window-popover${opensUp ? ' opens-up' : ''}`}>
      <div className="pickup-window-summary"><button type="button" className={activePart === 'start' ? 'active' : ''} onClick={() => setActivePart('start')}><span>Pickup starts</span><strong>{formatPart(startValue)}</strong></button><span className="pickup-window-arrow">→</span><button type="button" className={activePart === 'end' ? 'active' : ''} onClick={() => setActivePart('end')}><span>Pickup ends</span><strong>{formatPart(endValue)}</strong></button></div>
      <div className="date-popover-header"><button type="button" className="icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={15} /></button><strong>{monthLabel(month)}</strong><button type="button" className="icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={15} /></button></div>
      <div className="date-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}</div>
      <div className="date-grid">{days.map((item, index) => item ? <button type="button" className={'date-day ' + ((activeValue && dateKey(parseDate(activeValue)) === dateKey(item)) ? 'selected ' : '') + ((startDate && dateKey(startDate) === dateKey(item)) || (endDate && dateKey(endDate) === dateKey(item)) ? 'range-day ' : '') + (dateKey(item) === dateKey(new Date()) ? 'today' : '')} key={dateKey(item)} onClick={() => selectDate(item)}>{item.getDate()}</button> : <span key={`empty-${index}`} />)}</div>
      <div className="pickup-window-times"><label>Start time<input type="time" value={startValue.slice(11) || '09:00'} onChange={event => setTime('start', event.target.value)} /></label><label>End time<input type="time" value={endValue.slice(11) || '10:00'} onChange={event => setTime('end', event.target.value)} /></label></div>
      <div className="date-popover-footer"><button type="button" className="button button-quiet" onClick={() => { selectDate(new Date()); }}>Today</button><button type="button" className="button button-primary pickup-window-done" onClick={() => setOpen(false)} disabled={!startValue || !endValue}>Done</button>{(startValue || endValue) && <button type="button" className="button button-quiet" onClick={clear}>Clear</button>}</div>
    </div>}
  </div>;
}
