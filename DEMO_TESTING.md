# RinseLine client demo test plan

## Start

Use the deployed `/login` URL with:

- `demo@rinseline.test`
- `demo1234`

No integration keys are required for this temporary dummy-data review.

## Suggested walkthrough

1. Open **Orders** and inspect the seeded orders across the lifecycle.
2. Open `RL-1048`, confirm pickup, and verify the status changes.
3. Open a `Ready for pickup` order and confirm processor pickup.
4. Open an `Out for delivery` order and confirm delivery.
5. Review **Dispatch** for processor capacity decisions.
6. Review **Routes** for pickup and return route planning.
7. Review **Driver app** for check-in, bag counts, discrepancies, and photo controls.
8. Review **Processor portal** for intake, processing, completion, and QC controls.
9. Review **Reports** for turnaround, reconciliation, quality, and scorecard views.
10. Create a new order and verify validation errors by leaving required fields empty.

## What to tell the client

This is a functional product walkthrough using safe dummy data. The operational screens and workflow are ready to review, while external services are intentionally simulated until the client supplies production accounts. Do not use real customer information in this link.

## Completion checklist

- [ ] Login page opens
- [ ] Dashboard loads on desktop and mobile width
- [ ] New order validation works
- [ ] Order detail opens
- [ ] Pickup status action works
- [ ] Processor pickup status action works
- [ ] Delivery status action works
- [ ] Processor and route screens open
- [ ] Driver and processor controls render
- [ ] Reports render
- [ ] No real SMS, map, storage, or customer data is used
