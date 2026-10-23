# RinseLine production roadmap

## Application foundation

- Supabase SSR authentication with email verification.
- Authenticated workspace loading from Supabase.
- Dispatcher, driver, processor, and customer navigation based on the authenticated profile role.
- Order intake, validation, lifecycle transitions, exceptions, photo evidence, and audit events.
- Processor records with capability, pricing, capacity, operating-hours, and scorecard fields.
- Production-only behavior: no seeded customers, processors, drivers, local sessions, or API fallbacks.

## Integration completion

> P0 implemented in code: manual validation review, atomic processor acceptance, four-hour offer-expiry fallback, and failed-route recovery. Apply migrations through `20261021_p0_atomic_offers_and_route_recovery.sql` before enabling these flows.

> P1 and P2 implemented in code: exception queues, processor issue intake, evidence review, filtered and paginated order operations, notification preferences, bounded SMS retry tracking, processor drop-off routes, and scheduled scorecard refresh. Apply migrations through `20261023_final_route_and_scorecard_gaps.sql` before enabling the complete workflow.

1. Configure Inngest functions for matching, capacity reminders, ready notifications, and 24–48 hour reviews.
2. Configure Twilio sender identities, opt-in preferences, and notification templates.
3. Configure Mapbox token and validate geocoding/directions quotas.
4. Add CRM webhook authentication and map the client’s final field contract.
5. Run end-to-end tests against a staging Supabase project before accepting live orders.

## Confirmed product requirements: GoHighLevel and laundry dispatch flow

This section records the agreed requirements only. It is documentation, not an implementation approval.

### Intake and system boundary

- Initial order sources are staff/manual entry and GoHighLevel (GHL) CRM/API.
- GHL is the customer/CRM intake channel; the dispatch platform owns the operational order workflow after intake.
- Do not create a second CRM module or duplicate CRM functionality in the dispatch platform.
- Both sources must eventually enter one normalized intake path and capture customer, location, service, items/textiles, quantity, timing, special handling, and customer specifications.
- The final integration contract must define GHL field mapping, authentication, external order ID, duplicate protection, retries, updates, cancellations, and which system is the source of truth.

### Agreed order lifecycle

1. Order created through GHL/API or staff/manual entry.
2. Required information is validated and the order is classified by service, textiles, quantity, special handling, turnaround, and customer specifications.
3. Eligible processors are generated and ranked by capability, location, capacity, turnaround, pricing/cost, performance, and customer requirements.
4. Processors receive the pending queue, accept or reject capacity, and rejection falls back to the next-ranked processor. Decisions are recorded.
5. Accepted orders are consolidated into pickup routes. Dispatch reviews, edits, and approves the recommended route.
6. The driver performs pickup check-in, photographs items/bags, records counts, compares expected quantity, records discrepancies, and confirms pickup.
7. The driver drops off at the processor with photo and quantity evidence. The order becomes At Processor.
8. The processor completes the work and marks it ready for pickup, triggering the ready notification.
9. Dispatch consolidates ready orders into a return pickup route and approves it.
10. The driver performs processor pickup and QC reconciliation against original pickup, processor intake, completed quantity, and current pickup quantity, including special requests, discrepancies, damage, and issue evidence.
11. The driver completes customer drop-off with arrival confirmation, photo, final count, and delivery confirmation. The order becomes Delivered/Complete.
12. Within 24–48 hours, dispatch reviews turnaround, quantity reconciliation, quality, special-request compliance, damages/losses, discrepancies, exceptions, and customer/driver feedback, then updates the processor scorecard.

### Canonical status flow

`Order Created` → `Validated & Classified` → `Processor Ranked` → `Capacity Confirmed` → `Pickup Scheduled` → `Picked Up` → `At Processor` → `Processing` → `Ready for Pickup` → `Picked Up from Processor` → `QC / Reconciliation` → `Out for Delivery` → `Delivered` → `Processor Reviewed`

### Required exception loops

- Invalid or conflicting order → manual review → correction → validation.
- Processor capacity rejection → next-ranked processor → capacity check.
- Pickup discrepancy → evidence and exception record → dispatcher review.
- Processor discrepancy → QC/resolution → processor scorecard.
- Quality issue → service recovery → resolution → scorecard.
- Route issue → dispatcher reroute → driver.

### Role applicability

- Super admins own configuration, access, overrides, reporting, and audit review.
- Dispatchers own validation review, processor matching/capacity, route approval, exceptions, and service recovery.
- Drivers own assigned routes, check-ins, photos, counts, handoffs, discrepancies, and delivery confirmation.
- Processors own capability/capacity details, acceptance/rejection, intake confirmation, processing completion, ready notifications, and issue reporting.
- Customers provide order details/specifications and receive appropriate order and delivery visibility.

### Documentation checkpoint before implementation

Before building the GHL adapter, confirm the GHL workflow/trigger, payload sample and field names, authentication/signing method, external order identifier, create/update/cancel behavior, retry and replay behavior, and source-of-truth rules. Until those are confirmed, retain staff/manual intake as the operational fallback and do not add a speculative CRM feature.
