import { Inngest } from 'inngest';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isSmsAllowed, sendOrderNotification } from '@/lib/notifications';

export const inngest = new Inngest({ id: 'rinseline-dispatch' });

async function notifyPendingProcessorOffers(orderId: string) {
  if (!supabaseAdmin) throw new Error('Supabase service role is not configured');
  const { data: workspace } = await supabaseAdmin.from('workspace_settings').select('company_name').eq('id', 'default').maybeSingle();
  const companyName = workspace?.company_name?.trim() || 'RinseLine';
  const { data: offers, error } = await supabaseAdmin.from('processor_offers').select('id,processor_id,orders(order_number,service_type,expected_bags,due_at_label),processors(name,phone)').eq('order_id', orderId).eq('status', 'pending');
  if (error) throw new Error(error.message);
  let notified = 0;
  for (const offer of offers ?? []) {
    const processor = Array.isArray(offer.processors) ? offer.processors[0] : offer.processors;
    const order = Array.isArray(offer.orders) ? offer.orders[0] : offer.orders;
    const recipient = processor?.phone;
    if (!recipient || !order) continue;
    if (!(await isSmsAllowed(recipient, 'processor_offer'))) continue;
    const { data: alreadyLogged } = await supabaseAdmin.from('notification_log').select('id').eq('order_id', orderId).eq('recipient', recipient).eq('event', 'processor_offer').limit(1);
    if (alreadyLogged?.length) continue;
    const message = `New ${companyName} capacity request: ${order.order_number} — ${order.service_type}, ${order.expected_bags} bag(s), due ${order.due_at_label || 'as scheduled'}. Sign in to accept or decline.`;
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
    const { data: deliveredEvents } = await supabaseAdmin.from('order_events').select('order_id,created_at').in('order_id', ids).eq('to_status', 'delivered').order('created_at', { ascending: true });
    const deliveredAt = new Map<string, string>();
    for (const event of deliveredEvents ?? []) if (!deliveredAt.has(event.order_id)) deliveredAt.set(event.order_id, event.created_at);
    const measurable = rows.filter(row => row.due_at && deliveredAt.has(row.id));
    const onTime = measurable.filter(row => new Date(deliveredAt.get(row.id) as string).getTime() <= new Date(row.due_at as string).getTime()).length;
    const onTimeRate = measurable.length ? Math.round((onTime / measurable.length) * 10000) / 100 : 100;
    const { data: exceptions } = await supabaseAdmin.from('exceptions').select('order_id').in('order_id', ids).gte('created_at', `${periodStart}T00:00:00.000Z`).lte('created_at', `${periodEnd}T23:59:59.999Z`);
    const issueCount = exceptions?.length ?? rows.filter(row => row.has_exception).length;
    const discrepancyRate = rows.length ? Math.round((new Set((exceptions ?? []).map(row => row.order_id)).size / rows.length) * 10000) / 100 : 0;
    await supabaseAdmin.from('processor_scorecards').upsert({ processor_id: processorId, period_start: periodStart, period_end: periodEnd, orders_completed: rows.length, on_time_rate: onTimeRate, discrepancy_rate: discrepancyRate, issue_count: issueCount, score: Math.max(0, Math.round((onTimeRate * .6 + (100 - discrepancyRate) * .25 + Math.max(0, 100 - issueCount / rows.length * 100) * .15) * 100) / 100), notes: 'Automatically refreshed by the scheduled processor review.', reviewed_at: new Date().toISOString() }, { onConflict: 'processor_id,period_start,period_end' });
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
