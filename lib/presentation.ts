const friendlyWords: Record<string, string> = {
  api: 'API',
  id: 'ID',
  sms: 'SMS',
  in_app: 'in-app',
  same_day: 'same day',
  bank_transfer: 'bank transfer',
  card_machine: 'card machine',
  partially_paid: 'partially paid',
  super_admin: 'super admin',
};

export function humanize(value: string) {
  return value
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .filter(Boolean)
    .map((word) => friendlyWords[word.toLowerCase()] ?? word.toLowerCase())
    .join(' ')
    .replace(/^./, (character) => character.toUpperCase());
}
