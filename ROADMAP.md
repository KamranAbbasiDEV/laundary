# RinseLine production roadmap

## Application foundation

- Supabase SSR authentication with email verification.
- Authenticated workspace loading from Supabase.
- Dispatcher, driver, processor, and customer navigation based on the authenticated profile role.
- Order intake, validation, lifecycle transitions, exceptions, photo evidence, and audit events.
- Processor records with capability, pricing, capacity, operating-hours, and scorecard fields.
- Production-only behavior: no seeded customers, processors, drivers, local sessions, or API fallbacks.

## Integration completion

1. Configure Inngest functions for matching, capacity reminders, ready notifications, and 24–48 hour reviews.
2. Configure Twilio sender identities, opt-in preferences, and notification templates.
3. Configure Mapbox token and validate geocoding/directions quotas.
4. Add CRM webhook authentication and map the client’s final field contract.
5. Add scheduled processor review jobs and scorecard persistence.
6. Run end-to-end tests against a staging Supabase project before accepting live orders.
