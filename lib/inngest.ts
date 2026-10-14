import { Inngest } from 'inngest';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendOrderNotification } from '@/lib/notifications';

export const inngest = new Inngest({ id: 'rinseline-dispatch' });

async function notifyPendingProcessorOffers(orderId: string) {
  if (!supabaseAdmin) throw new Error('Supabase service role is not configured');
  const { data: offers, error } = await supabaseAdmin.from('processor_offers').select('id,processor_id,orders(order_number,service_type,expected_bags,due_at_label),processors(name,phone)').eq('order_id', orderId).eq('status', 'pending');
  if (error) throw new Error(error.message);
  let notified = 0;
  for (const offer of offers ?? []) {
    const processor = Array.isArray(offer.processors) ? offer.processors[0] : offer.processors;
    const order = Array.isArray(offer.orders) ? offer.orders[0] : offer.orders;
    const recipient = processor?.phone;
    if (!recipient || !order) continue;
    const { data: alreadyLogged } = await supabaseAdmin.from('notification_log').select('id').eq('order_id', orderId).eq('recipient', recipient).eq('event', 'processor_offer').limit(1);
    if (alreadyLogged?.length) continue;
    const message = `New RinseLine capacity request: ${order.order_number} — ${order.service_type}, ${order.expected_bags} bag(s), due ${order.due_at_label || 'as scheduled'}. Sign in to accept or decline.`;
    const result = await sendOrderNotification({ to: recipient, message, channel: 'sms' });
    const { error: logError } = await supabaseAdmin.from('notification_log').insert({ order_id: orderId, recipient, channel: 'sms', event: 'processor_offer', message, status: result.delivered ? 'sent' : 'queued', provider_id: result.delivered ? result.sid : null, error_message: result.delivered ? null : result.reason ?? null, sent_at: result.delivered ? new Date().toISOString() : null });
    if (logError) throw new Error(logError.message);
    notified += 1;
  }
  return { notified };
}

async function queueProcessorReviews() {
  if (!supabaseAdmin) throw new Error('Supabase service role is not configured');
  const reviewCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: orders, error } = await supabaseAdmin.from('orders').select('id,order_number,processor_id,updated_at').eq('status', 'delivered').lte('updated_at', reviewCutoff).not('processor_id', 'is', null);
  if (error) throw new Error(error.message);
  let queued = 0;
  for (const order of orders ?? []) {
    const { data: existing } = await supabaseAdmin.from('notification_log').select('id').eq('order_id', order.id).eq('event', 'processor_review_due').limit(1);
    if (existing?.length) continue;
    const { error: logError } = await supabaseAdmin.from('notification_log').insert({ order_id: order.id, recipient: 'operations', channel: 'in_app', event: 'processor_review_due', message: `${order.order_number} is ready for its 24–48 hour processor performance review.`, status: 'queued' });
    if (logError) throw new Error(logError.message);
    queued += 1;
  }
  return { queued };
}

export const orderValidated = inngest.createFunction(
  { id: 'processor-offer-notification', triggers: [{ event: 'rinseline/order.validated' }, { event: 'rinseline/order.processor_offer_activated' }] },
  async ({ event, step }) => step.run('notify-pending-processors', () => notifyPendingProcessorOffers(event.data.orderId as string))
);

export const processorReviewReminder = inngest.createFunction(
  { id: 'processor-review-reminder', triggers: [{ cron: 'TZ=America/Chicago 0 9 * * *' }] },
  async ({ step }) => step.run('queue-24-hour-processor-reviews', queueProcessorReviews)
);
