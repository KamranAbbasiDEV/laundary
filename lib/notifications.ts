import { supabaseAdmin } from '@/lib/supabase-admin';

export type NotificationChannel = 'sms' | 'email';

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

export async function logOperationalNotification(input: { orderId?: string; event: string; message: string; phone?: string }) {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from('notification_log').insert({ order_id: input.orderId ?? null, recipient: 'operations', channel: 'in_app', event: input.event, message: input.message, status: 'sent', sent_at: new Date().toISOString() });
  if (!input.phone) return;
  const sms = await sendOrderNotification({ to: input.phone, message: input.message, channel: 'sms' });
  await supabaseAdmin.from('notification_log').insert({ order_id: input.orderId ?? null, recipient: input.phone, channel: 'sms', event: input.event, message: input.message, status: sms.delivered ? 'sent' : 'queued', provider_id: sms.delivered ? sms.sid : null, error_message: sms.delivered ? null : sms.reason ?? null, sent_at: sms.delivered ? new Date().toISOString() : null });
}
