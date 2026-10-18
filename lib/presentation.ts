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

const friendlyPhrases: Record<string, string> = {
  processor_dropoff: 'Processor drop-off',
  processor_pickup: 'Processor pickup',
  customer_pickup: 'Customer pickup',
  customer_delivery: 'Customer delivery',
  qc_reconciliation: 'Quality check and reconciliation',
  in_progress: 'In progress',
  partially_paid: 'Partially paid',
  ready_for_pickup: 'Ready for pickup',
  picked_up_from_processor: 'Picked up from processor',
  super_admin: 'Super Admin',
};

export function humanize(value: string) {
  if (friendlyPhrases[value]) return friendlyPhrases[value];
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
