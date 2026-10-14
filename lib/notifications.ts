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
