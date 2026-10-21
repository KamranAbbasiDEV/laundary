export function pickupDeadlineError(input: { pickupStartAt?: string | null; pickupEndAt?: string | null; deadlineAt?: string | null }) {
  const { pickupStartAt, pickupEndAt, deadlineAt } = input;
  if ((pickupStartAt && !pickupEndAt) || (!pickupStartAt && pickupEndAt)) return 'Pickup window start and end are both required.';
  if (!pickupStartAt || !pickupEndAt || !deadlineAt) return null;
  const start = new Date(pickupStartAt).getTime();
  const end = new Date(pickupEndAt).getTime();
  const deadline = new Date(deadlineAt).getTime();
  if (![start, end, deadline].every(Number.isFinite)) return 'Pickup window and requested deadline must be valid date and time values.';
  if (end < start) return 'Pickup window end must be after its start time.';
  if (deadline <= end) return 'Requested customer deadline must be after the pickup window ends.';
  return null;
}
