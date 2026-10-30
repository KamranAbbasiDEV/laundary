'use client';

import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from './ui/button';
import { notifyDataChanged } from '@/lib/live-updates';

type Offer = {
  id: string;
  status: string;
  rank: number;
  score: number;
  orders?: { order_number: string; customer_name: string; service_type: string; expected_bags: number; due_at_label?: string };
};

export default function ProcessorOffersPanel({ notify }: { notify: (message: string) => void }) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState('');
  const [reason, setReason] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/processor-offers', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load capacity offers.');
      setOffers(body.offers ?? []);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load capacity offers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener('rinseline:data-changed', refresh);
    return () => window.removeEventListener('rinseline:data-changed', refresh);
  }, []);

  async function decide(offer: Offer, decision: 'accepted' | 'rejected') {
    if (decision === 'rejected' && rejecting !== offer.id) {
      setRejecting(offer.id);
      setReason('');
      return;
    }
    setBusy(offer.id);
    try {
      const response = await fetch('/api/processor-offers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId: offer.id, decision, reason: decision === 'rejected' ? reason.trim() || 'Processor declined' : undefined }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to update processor offer');
      setOffers(current => current.map(item => item.id === offer.id ? body.offer : item));
      setRejecting('');
      notifyDataChanged();
      notify(body.offer?.warning || (decision === 'accepted' ? 'Order accepted. Dispatch can now plan its pickup.' : 'Order rejected and sent to the next eligible processor or dispatcher review.'));
    } catch (value) {
      notify(value instanceof Error ? value.message : 'Unable to update processor offer.');
    } finally {
      setBusy('');
    }
  }

  const pending = offers.filter(offer => offer.status === 'pending');

  return (
    <section className="panel processor-offers-panel">
      <div className="panel-heading processor-offers-heading">
        <div><h2>Pending capacity requests</h2><p>Review work that needs a capacity decision before it enters production.</p></div>
        <span className="status status-amber">{pending.length} pending</span>
      </div>
      {error ? (
        <div className="processor-offers-empty">{error}<Button size="sm" variant="outline" onClick={() => void load()}>Try again</Button></div>
      ) : loading ? (
        <div className="processor-offers-empty"><span className="inline-loading"><span />Loading capacity requests...</span></div>
      ) : pending.length ? (
        <div className="processor-offer-list">
          {pending.map(offer => (
            <div className="processor-offer-row" key={offer.id}>
              <div className="processor-offer-summary"><strong>{offer.orders?.order_number || 'Order'}</strong><span>{offer.orders?.customer_name || 'Customer'} · {offer.orders?.service_type || 'Service'} · {offer.orders?.expected_bags ?? 0} bags</span></div>
              <span className="processor-offer-rank">Rank #{offer.rank}</span>
              {rejecting === offer.id ? (
                <div className="processor-offer-reject"><input className="form-control" aria-label="Rejection reason" value={reason} onChange={event => setReason(event.target.value)} placeholder="Reason (optional)" /><Button size="sm" variant="destructive" onClick={() => void decide(offer, 'rejected')} disabled={Boolean(busy)}>{busy === offer.id ? 'Saving...' : 'Confirm reject'}</Button><Button size="sm" variant="outline" onClick={() => setRejecting('')}>Cancel</Button></div>
              ) : (
                <div className="processor-offer-actions"><Button size="sm" onClick={() => void decide(offer, 'accepted')} disabled={Boolean(busy)}><Check size={13} />{busy === offer.id ? 'Saving...' : 'Accept'}</Button><Button size="sm" variant="destructive" onClick={() => void decide(offer, 'rejected')} disabled={Boolean(busy)}><X size={13} />Reject</Button></div>
              )}
            </div>
          ))}
        </div>
      ) : <div className="processor-offers-empty">No processor offers require a decision.</div>}
    </section>
  );
}
