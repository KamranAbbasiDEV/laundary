'use client';

import { useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { DateField, PickupWindowField } from './ui/date-field';
import { pickupDeadlineError } from '@/lib/order-scheduling';
import { defaultServiceCatalog, type ServiceCatalogItem } from '@/lib/service-catalog';

const pad = (value: number) => String(value).padStart(2, '0');
const deadlineMinimum = (value: string) => { const date = new Date(value); if (Number.isNaN(date.getTime())) return undefined; date.setMinutes(date.getMinutes() + 1); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`; };

export const orderSchema = z.object({
  customer: z.string().min(2, 'Customer name is required'),
  phone: z.string().min(7, 'Phone number is required'),
  address: z.string().min(5, 'Pickup address is required'),
  service: z.string().min(1),
  bags: z.number().min(1),
  pickupStart: z.string().min(1, 'Pickup start is required'),
  pickupEnd: z.string().min(1, 'Pickup end is required'),
  deadline: z.string().min(1, 'Requested customer deadline is required'),
  notes: z.string().optional()
}).superRefine((value, context) => {
  const error = pickupDeadlineError({ pickupStartAt: value.pickupStart, pickupEndAt: value.pickupEnd, deadlineAt: value.deadline });
  if (!error) return;
  const path = error.includes('Pickup window end') || error.includes('Pickup window start and end') ? ['pickupEnd'] : ['deadline'];
  context.addIssue({ code: 'custom', path, message: error });
});

export type OrderForm = z.infer<typeof orderSchema>;

type Props = {
  onClose: () => void;
  onCreate: (data: OrderForm) => Promise<void>;
  title?: string;
  description?: string;
  submitLabel?: string;
  services?: ServiceCatalogItem[];
};

export default function NewOrderModal({
  onClose,
  onCreate,
  title = 'Create new order',
  description = 'One focused form; matching starts automatically after validation.',
  submitLabel = 'Create and match',
  services = defaultServiceCatalog
}: Props) {
  const { register, control, watch, setValue, handleSubmit, formState: { errors, isSubmitting, isValid } } = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    mode: 'onChange',
    defaultValues: { service: 'Wash & Fold', bags: 1, pickupStart: '', pickupEnd: '', deadline: '' }
  });
  const [submitError, setSubmitError] = useState('');
  const pickupStart = watch('pickupStart');
  const pickupEnd = watch('pickupEnd');
  const deadlineMin = pickupEnd ? deadlineMinimum(pickupEnd) : undefined;

  async function submit(data: OrderForm) {
    setSubmitError('');
    try {
      await onCreate(data);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to create order.');
    }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="new-order-title">
      <header className="modal-header">
        <div><h2 id="new-order-title">{title}</h2><p>{description}</p></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={16}/></button>
      </header>
      <form onSubmit={handleSubmit(submit)}>
        <div className="modal-body">
          <div className="form-grid">
            <Field label="Customer"><input className="form-control" {...register('customer')}/>{errors.customer && <span className="field-error">{errors.customer.message}</span>}</Field>
            <Field label="Phone"><input className="form-control" {...register('phone')}/>{errors.phone && <span className="field-error">{errors.phone.message}</span>}</Field>
            <Field label="Pickup address" full><input className="form-control" {...register('address')}/>{errors.address && <span className="field-error">{errors.address.message}</span>}</Field>
            <Field label="Service"><select className="form-control" {...register('service')}>{services.map(service => <option key={service.name} value={service.name}>{service.name}</option>)}</select></Field>
            <Field label="Expected bags"><input type="number" min="1" className="form-control" {...register('bags', { valueAsNumber: true })}/></Field>
            <Field label="Pickup window" full><PickupWindowField startValue={pickupStart ?? ''} endValue={pickupEnd ?? ''} onStartChange={value => setValue('pickupStart', value, { shouldDirty: true, shouldValidate: true })} onEndChange={value => setValue('pickupEnd', value, { shouldDirty: true, shouldValidate: true })} disabled={isSubmitting} aria-label="Pickup window" />{(errors.pickupStart || errors.pickupEnd) && <span className="field-error">{errors.pickupStart?.message || errors.pickupEnd?.message}</span>}</Field>
            <Field label="Requested customer deadline" full><Controller control={control} name="deadline" render={({ field }) => <DateField type="datetime-local" value={field.value ?? ''} min={deadlineMin} onChange={field.onChange} disabled={isSubmitting} aria-label="Requested customer deadline" />}/>{errors.deadline && <span className="field-error">{errors.deadline.message}</span>}</Field>
            <Field label="Notes" full><textarea className="form-control" {...register('notes')}/></Field>
          </div>
          {submitError && <div className="field-error" role="alert" style={{ marginTop: 12 }}>{submitError}</div>}
        </div>
        <footer className="modal-footer"><button type="button" className="button button-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button><button type="submit" className="button button-primary" disabled={isSubmitting || !isValid}>{isSubmitting ? 'Creating...' : submitLabel}</button></footer>
      </form>
    </section>
  </div>;
}

function Field({ label, full, children }: { label: string; full?: boolean; children: ReactNode }) {
  return <div className={`form-field ${full ? 'full' : ''}`}><label>{label}</label>{children}</div>;
}
