import { Inngest } from 'inngest';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isSmsAllowed, sendOrderNotification } from '@/lib/notifications';

export const inngest = new Inngest({ id: 'rinseline-dispatch' });

async function notifyPendingProcessorOffers(orderId: string) {
  if (!supabaseAdmin) throw new Error('Supabase service role is not configured');
  const { data: workspace } = await supabaseAdmin.from('workspace_settings').select('company_name').eq('id', 'default').maybeSingle();
  const companyName = workspace?.company_name?.trim() || 'RinseLine';
  const { data: offers, error } = await supabaseAdmin.from('processor_offers').select('id,processor_id,orders(order_number,service_type,expected_bags,due_at_label,due_at),processors(name,phone)').eq('order_id', orderId).eq('status', 'pending');
  if (error) throw new Error(error.message);
  let notified = 0;
  for (const offer of offers ?? []) {
    const processor = Array.isArray(offer.processors) ? offer.processors[0] : offer.processors;
    const order = Array.isArray(offer.orders) ? offer.orders[0] : offer.orders;
    const recipient = processor?.phone;
    if (!recipient || !order) continue;
    const message = `New ${companyName} capacity request for ${order.order_number}.`;
    const { data: inAppAlreadyLogged } = await supabaseAdmin.from('notification_log').select('id').eq('order_id', orderId).eq('recipient', `processor:${offer.processor_id}`).eq('event', 'processor_offer').limit(1);
    if (!inAppAlreadyLogged?.length) {
      const { error: inAppError } = await supabaseAdmin.from('notification_log').insert({ order_id: orderId, recipient: `processor:${offer.processor_id}`, channel: 'in_app', event: 'processor_offer', message, status: 'sent', sent_at: new Date().toISOString() });
      if (inAppError) throw new Error(inAppError.message);
    }
    if (!(await isSmsAllowed(recipient, 'processor_offer'))) continue;
    const { data: alreadyLogged } = await supabaseAdmin.from('notification_log').select('id').eq('order_id', orderId).eq('recipient', recipient).eq('event', 'processor_offer').limit(1);
    if (alreadyLogged?.length) continue;
    const deadline = order.due_at ? `, deadline ${new Date(order.due_at).toLocaleString()}` : '';
    const smsMessage = `New ${companyName} capacity request: ${order.order_number} - ${order.service_type}, ${order.expected_bags} bag(s), due ${order.due_at_label || 'as scheduled'}${deadline}. Sign in to accept or decline.`;
    const result = await sendOrderNotification({ to: recipient, message: smsMessage, channel: 'sms' });
    const { error: logError } = await supabaseAdmin.from('notification_log').insert({ order_id: orderId, recipient, channel: 'sms', event: 'processor_offer', message: smsMessage, status: result.delivered ? 'sent' : 'queued', provider_id: result.delivered ? result.sid : null, error_message: result.delivered ? null : result.reason ?? null, sent_at: result.delivered ? new Date().toISOString() : null });
    if (logError) throw new Error(logError.message);
    notified += 1;
  }
  return { notified };
}

async function queueProcessorReviews() {
  if (!supabaseAdmin) throw new Error('Supabase service role is not configured');
  const reviewCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: orders, error } = await supabaseAdmin.from('orders').select('id,order_number,processor_id,updated_at,due_at,has_exception').eq('status', 'delivered').lte('updated_at', reviewCutoff).not('processor_id', 'is', null);
  if (error) throw new Error(error.message);
  let queued = 0;
  for (const order of orders ?? []) {
    const { data: existing } = await supabaseAdmin.from('notification_log').select('id').eq('order_id', order.id).eq('event', 'processor_review_due').limit(1);
    if (existing?.length) continue;
    const { error: logError } = await supabaseAdmin.from('notification_log').insert({ order_id: order.id, recipient: 'operations', channel: 'in_app', event: 'processor_review_due', message: `${order.order_number} is ready for its 24–48 hour processor performance review.`, status: 'queued' });
    if (logError) throw new Error(logError.message);
    queued += 1;
  }
  const byProcessor = new Map<string, typeof orders>();
  for (const order of orders ?? []) { const rows = byProcessor.get(order.processor_id) ?? []; rows.push(order); byProcessor.set(order.processor_id, rows); }
  const periodStart = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const periodEnd = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  for (const [processorId, rows] of byProcessor) {
    const ids = rows.map(row => row.id);
    const { data: deliveredEvents } = await supabaseAdmin.from('order_events').select('order_id,created_at').in('order_id', ids).eq('to_status', 'delivered').gte('created_at', `${periodStart}T00:00:00.000Z`).lte('created_at', `${periodEnd}T23:59:59.999Z`).order('created_at', { ascending: true });
    const deliveredAt = new Map<string, string>();
    for (const event of deliveredEvents ?? []) if (!deliveredAt.has(event.order_id)) deliveredAt.set(event.order_id, event.created_at);
    const completed = rows.filter(row => deliveredAt.has(row.id));
    const measurable = completed.filter(row => row.due_at);
    const onTime = measurable.filter(row => new Date(deliveredAt.get(row.id) as string).getTime() <= new Date(row.due_at as string).getTime()).length;
    const onTimeRate = measurable.length ? Math.round((onTime / measurable.length) * 10000) / 100 : 0;
    const completedIds = completed.map(row => row.id);
    const { data: exceptions } = completedIds.length ? await supabaseAdmin.from('exceptions').select('order_id').in('order_id', completedIds).gte('created_at', `${periodStart}T00:00:00.000Z`).lte('created_at', `${periodEnd}T23:59:59.999Z`) : { data: [] };
    const issueCount = new Set((exceptions ?? []).map(row => row.order_id)).size;
    const discrepancyRate = completed.length ? Math.round((issueCount / completed.length) * 10000) / 100 : 0;
    const score = Math.max(0, Math.round(((measurable.length ? onTimeRate * .6 : 0) + (100 - discrepancyRate) * (measurable.length ? .4 : 1)) * 100) / 100);
    await supabaseAdmin.from('processor_scorecards').upsert({ processor_id: processorId, period_start: periodStart, period_end: periodEnd, orders_completed: completed.length, on_time_rate: onTimeRate, discrepancy_rate: discrepancyRate, issue_count: issueCount, score, notes: `Automatically refreshed by the scheduled processor review.${measurable.length ? '' : ' Turnaround is neutral: no completed order in this period had an exact due timestamp.'}`, reviewed_at: new Date().toISOString() }, { onConflict: 'processor_id,period_start,period_end' });
  }
  return { queued };
}

async function retryQueuedNotifications() {
  if (!supabaseAdmin) throw new Error('Supabase service role is not configured');
  const { data: queued, error } = await supabaseAdmin.from('notification_log').select('id,recipient,message,attempt_count,max_attempts').eq('channel', 'sms').eq('status', 'queued').lt('attempt_count', 5).order('created_at').limit(50);
  if (error) throw new Error(error.message);
  let sent = 0;
  for (const item of queued ?? []) {
    const result = await sendOrderNotification({ to: item.recipient, message: item.message, channel: 'sms' });
    const attemptCount = (item.attempt_count ?? 0) + 1;
    const attemptedAt = new Date().toISOString();
    const exhausted = attemptCount >= (item.max_attempts ?? 5);
    const { error: updateError } = await supabaseAdmin.from('notification_log').update({ status: result.delivered ? 'sent' : exhausted ? 'failed' : 'queued', attempt_count: attemptCount, last_attempt_at: attemptedAt, provider_id: result.delivered ? result.sid : null, error_message: result.delivered ? null : result.reason ?? 'retry-failed', sent_at: result.delivered ? attemptedAt : null }).eq('id', item.id);
    if (updateError) throw new Error(updateError.message);
    if (result.delivered) sent += 1;
  }
  return { attempted: queued?.length ?? 0, sent };
}

async function advanceExpiredProcessorOffers() {
  if (!supabaseAdmin) throw new Error('Supabase service role is not configured');
  const { data, error } = await supabaseAdmin.rpc('advance_expired_processor_offers');
  if (error) throw new Error(error.message);
  let activated = 0;
  for (const row of data ?? []) {
    await notifyPendingProcessorOffers(row.order_id);
    activated += 1;
  }
  return { activated };
}

export const orderValidated = inngest.createFunction(
  { id: 'processor-offer-notification', triggers: [{ event: 'rinseline/order.validated' }, { event: 'rinseline/order.processor_offer_activated' }] },
  async ({ event, step }) => step.run('notify-pending-processors', () => notifyPendingProcessorOffers(event.data.orderId as string))
);

export const processorReviewReminder = inngest.createFunction(
  { id: 'processor-review-reminder', triggers: [{ cron: 'TZ=America/Chicago 0 9 * * *' }] },
  async ({ step }) => step.run('queue-24-hour-processor-reviews', queueProcessorReviews)
);

export const notificationRetry = inngest.createFunction(
  { id: 'notification-retry', triggers: [{ cron: '*/15 * * * *' }] },
  async ({ step }) => step.run('retry-queued-sms-notifications', retryQueuedNotifications)
);

export const processorOfferExpiry = inngest.createFunction(
  { id: 'processor-offer-expiry', triggers: [{ cron: '*/15 * * * *' }] },
  async ({ step }) => step.run('advance-expired-processor-offers', advanceExpiredProcessorOffers)
);
