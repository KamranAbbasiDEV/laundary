export function pickupDeadlineError(input: { pickupStartAt?: string | null; pickupEndAt?: string | null; deadlineAt?: string | null }) {
  const { pickupStartAt, pickupEndAt, deadlineAt } = input;
  if ((pickupStartAt && !pickupEndAt) || (!pickupStartAt && pickupEndAt)) return 'Pickup window start and end are both required.';
  if (!pickupStartAt || !pickupEndAt || !deadlineAt) return null;
  const start = new Date(pickupStartAt).getTime();
  const end = new Date(pickupEndAt).getTime();
  const deadline = new Date(deadlineAt).getTime();
  if (![start, end, deadline].every(Number.isFinite)) return 'Pickup window and requested deadline must be valid date and time values.';
  if (end <= start) return 'Pickup window end must be after its start time.';
  if (deadline <= end) return 'Requested customer deadline must be after the pickup window ends.';
  return null;
}

export function orderWindowError(
  input: {
    pickupStartAt?: string | null;
    pickupEndAt?: string | null;
    deliveryStartAt?: string | null;
    deliveryEndAt?: string | null;
  },
  options: { notBefore?: string | null; toleranceMs?: number } = {},
) {
  const { pickupStartAt, pickupEndAt, deliveryStartAt, deliveryEndAt } = input;
  if (!pickupStartAt || !pickupEndAt || !deliveryStartAt || !deliveryEndAt) return null;
  const pickupStart = new Date(pickupStartAt).getTime();
  const pickupEnd = new Date(pickupEndAt).getTime();
  const deliveryStart = new Date(deliveryStartAt).getTime();
  const deliveryEnd = new Date(deliveryEndAt).getTime();
  if (![pickupStart, pickupEnd, deliveryStart, deliveryEnd].every(Number.isFinite)) return 'Pickup and delivery windows must contain valid dates and times.';
  if (options.notBefore) {
    const notBefore = new Date(options.notBefore).getTime();
    if (Number.isFinite(notBefore) && pickupStart < notBefore - (options.toleranceMs ?? 0)) return 'Pickup start cannot be in the past.';
  }
  if (pickupEnd <= pickupStart) return 'Pickup window end must be after its start time.';
  if (deliveryStart <= pickupEnd) return 'Delivery window must begin after the pickup window ends.';
  if (deliveryEnd <= deliveryStart) return 'Delivery window end must be after its start time.';
  return null;
}
