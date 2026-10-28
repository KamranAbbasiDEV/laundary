import { supabaseAdmin } from '@/lib/supabase-admin';

export type NotificationChannel = 'sms' | 'email';

export async function isSmsAllowed(phone: string, event: string) {
  if (!supabaseAdmin) return true;
  const { data: recipient } = await supabaseAdmin.from('profiles').select('id').eq('phone', phone).maybeSingle();
  if (!recipient?.id) return true;
  const { data: preferences } = await supabaseAdmin.from('notification_preferences').select('sms_enabled,processor_offer_sms,route_update_sms').eq('user_id', recipient.id).maybeSingle();
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
  const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ Body: input.message, From: from, To: input.to }) });
  const result = await response.json();
  if (!response.ok) return { delivered: false, reason: result.message || 'twilio-request-failed' };
  return { delivered: true, sid: result.sid as string, to: input.to };
}

async function recordNotification(entry: Record<string, unknown>) {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin.from('notification_log').insert(entry);
  if (error) console.error('Unable to persist notification log entry:', error.message);
}

export async function logOperationalNotification(input: { orderId?: string; event: string; message: string; phone?: string }) {
  if (!supabaseAdmin) return;
  await recordNotification({ order_id: input.orderId ?? null, recipient: 'operations', channel: 'in_app', event: input.event, message: input.message, status: 'sent', sent_at: new Date().toISOString() });
  if (!input.phone) return;
  if (!(await isSmsAllowed(input.phone, input.event))) return;
  const sms = await sendOrderNotification({ to: input.phone, message: input.message, channel: 'sms' });
  const attemptedAt = new Date().toISOString();
  await recordNotification({ order_id: input.orderId ?? null, recipient: input.phone, channel: 'sms', event: input.event, message: input.message, status: sms.delivered ? 'sent' : 'queued', attempt_count: 1, last_attempt_at: attemptedAt, provider_id: sms.delivered ? sms.sid : null, error_message: sms.delivered ? null : sms.reason ?? null, sent_at: sms.delivered ? attemptedAt : null });
}

export async function logCustomerNotification(input: { orderId: string; event: string; message: string; phone?: string; customerUserId?: string | null }) {
  if (!supabaseAdmin) return;
  const now = new Date().toISOString();
  await recordNotification({ order_id: input.orderId, recipient: input.customerUserId ? `customer:${input.customerUserId}` : 'customer', channel: 'in_app', event: input.event, message: input.message, status: 'sent', sent_at: now });
  if (!input.phone || !(await isSmsAllowed(input.phone, input.event))) return;
  const sms = await sendOrderNotification({ to: input.phone, message: input.message, channel: 'sms' });
  const attemptedAt = new Date().toISOString();
  await recordNotification({ order_id: input.orderId, recipient: input.phone, channel: 'sms', event: input.event, message: input.message, status: sms.delivered ? 'sent' : 'queued', attempt_count: 1, last_attempt_at: attemptedAt, provider_id: sms.delivered ? sms.sid : null, error_message: sms.delivered ? null : sms.reason ?? null, sent_at: sms.delivered ? attemptedAt : null });
}
