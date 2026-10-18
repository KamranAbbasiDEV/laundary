'use client';

import { CalendarDays, Clock3, X } from 'lucide-react';
import { useRef } from 'react';
import type { ChangeEvent } from 'react';

type Props = { value: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; type?: 'date' | 'datetime-local'; min?: string; max?: string; disabled?: boolean; 'aria-label'?: string };

function displayValue(value: string, type: Props['type']) {
  if (!value) return type === 'datetime-local' ? 'Choose date and time' : 'Choose a date';
  const date = new Date(type === 'date' ? value + 'T00:00:00' : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, type === 'datetime-local' ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(date);
}

export function DateField({ value, onChange, type = 'date', min, max, disabled, 'aria-label': ariaLabel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const openPicker = () => {
    if (disabled) return;
    const input = inputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') input.showPicker();
    else input.click();
  };
  return <div className="date-field"><button type="button" className="date-field-trigger" onClick={openPicker} disabled={disabled} aria-label={ariaLabel || displayValue(value, type)}><span className="date-field-icon">{type === 'datetime-local' ? <Clock3 size={15} /> : <CalendarDays size={15} />}</span><span>{displayValue(value, type)}</span>{value && <span className="date-field-clear" role="button" aria-label="Clear date" onClick={event => { event.stopPropagation(); if (inputRef.current) { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set; setter?.call(inputRef.current, ''); inputRef.current.dispatchEvent(new Event('input', { bubbles: true })); } }}><X size={14} /></span>}</button><input ref={inputRef} className="date-field-native" type={type} value={value} min={min} max={max} disabled={disabled} onChange={onChange} aria-hidden="true" tabIndex={-1} /></div>;
}
