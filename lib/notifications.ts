import { supabaseAdmin } from '@/lib/supabase-admin';
import type { SupabaseClient } from '@supabase/supabase-js';

export type NotificationChannel = 'sms' | 'email';

export async function isSmsAllowed(phone: string, event: string, userId?: string | null) {
  if (!supabaseAdmin) return true;
  let recipientId = userId ?? null;
  if (!recipientId) {
    const { data: recipient, error: recipientError } = await supabaseAdmin.from('profiles').select('id').eq('phone', phone).maybeSingle();
    if (recipientError) return false;
    recipientId = recipient?.id ?? null;
  }
  if (!recipientId) return true;
  const { data: preferences, error: preferenceError } = await supabaseAdmin.from('notification_preferences').select('sms_enabled,processor_offer_sms,route_update_sms').eq('user_id', recipientId).maybeSingle();
  if (preferenceError) return false;
  if (!preferences || preferences.sms_enabled === false) return preferences ? false : true;
  if (event.includes('processor_offer') && preferences.processor_offer_sms === false) return false;
  if (event.includes('route') && preferences.route_update_sms === false) return false;
  return true;
}

export async function sendOrderNotification(input: { to: string; message: string; channel?: NotificationChannel }) {
  if (input.channel !== 'sms') return { delivered: false, reason: 'unsupported-channel' };
  const { TWILIO_ACCOUNT_SID: accountSid, TWILIO_AUTH_TOKEN: authToken, TWILIO_FROM_NUMBER: from } = process.env;
  if (!accountSid || !authToken || !from) return { delivered: false, reason: 'notification-provider-not-configured' };
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ Body: input.message, From: from, To: input.to }) });
    const result = await response.json();
    if (!response.ok) return { delivered: false, reason: result.message || 'twilio-request-failed' };
    return { delivered: true, sid: result.sid as string, to: input.to };
  } catch (error) {
    return { delivered: false, reason: error instanceof Error ? error.message : 'notification-provider-unreachable' };
  }
}

async function recordNotification(entry: Record<string, unknown>, client?: SupabaseClient) {
  const databases = [client, supabaseAdmin].filter((database, index, values): database is SupabaseClient => Boolean(database) && values.indexOf(database) === index);
  let lastError: string | null = null;
  for (const database of databases) {
    const { error } = await database.from('notification_log').insert(entry);
    if (!error) return;
    lastError = error.message;
  }
  if (lastError) console.error('Unable to persist notification log entry:', lastError);
}

export async function logOperationalNotification(input: { orderId?: string; event: string; message: string; phone?: string }, client?: SupabaseClient) {
  await recordNotification({ order_id: input.orderId ?? null, recipient: 'operations', channel: 'in_app', event: input.event, message: input.message, status: 'sent', sent_at: new Date().toISOString() }, client);
}

export async function logSmsNotification(input: { orderId?: string; event: string; message: string; phone?: string | null; userId?: string | null }, client?: SupabaseClient) {
  if (!input.phone) return { delivered: false, skipped: true };
  if (!(await isSmsAllowed(input.phone, input.event, input.userId))) {
    await recordNotification({ order_id: input.orderId ?? null, recipient: input.phone, channel: 'sms', event: input.event, message: input.message, status: 'failed', error_message: 'disabled-by-recipient' }, client);
    return { delivered: false, skipped: true };
  }
  const sms = await sendOrderNotification({ to: input.phone, message: input.message, channel: 'sms' });
  const attemptedAt = new Date().toISOString();
  await recordNotification({ order_id: input.orderId ?? null, recipient: input.phone, channel: 'sms', event: input.event, message: input.message, status: sms.delivered ? 'sent' : 'queued', attempt_count: 1, last_attempt_at: attemptedAt, provider_id: sms.delivered ? sms.sid : null, error_message: sms.delivered ? null : sms.reason ?? null, sent_at: sms.delivered ? attemptedAt : null }, client);
  return { ...sms, skipped: false };
}

export async function logCustomerNotification(input: { orderId: string; event: string; message: string; phone?: string; customerUserId?: string | null }, client?: SupabaseClient) {
  const now = new Date().toISOString();
  await recordNotification({ order_id: input.orderId, recipient: input.customerUserId ? `customer:${input.customerUserId}` : 'customer', channel: 'in_app', event: input.event, message: input.message, status: 'sent', sent_at: now }, client);
  await logSmsNotification({ orderId: input.orderId, event: input.event, message: input.message, phone: input.phone, userId: input.customerUserId }, client);
}
