import { Inngest } from 'inngest';

export const inngest = new Inngest({ id: 'rinseline-dispatch' });

export const orderValidated = inngest.createFunction(
  { id: 'order-validated-processor-matching', triggers: [{ event: 'rinseline/order.validated' }] },
  async ({ event }) => ({ orderId: event.data.orderId, action: 'rank_processors' })
);

export const processorReviewReminder = inngest.createFunction(
  { id: 'processor-review-reminder', triggers: [{ cron: 'TZ=America/Chicago 0 9 * * *' }] },
  async () => ({ action: 'review_completed_orders', windowHours: 48 })
);
