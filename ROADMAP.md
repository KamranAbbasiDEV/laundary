# RinseLine delivery roadmap

## Implemented in this slice

- Dispatcher dashboard with live order pipeline, route board, exceptions, search, and order detail timeline.
- Intake form with React Hook Form + Zod validation.
- Lifecycle transitions from validation through pickup, processing, QC, delivery, and processor review.
- Minimal sign-in experience at `/login`.
- Supabase-ready schema for orders, processors, events, exceptions, and route stops with RLS policies.
- API boundary at `POST /api/orders`; it uses Supabase when configured and a local fallback otherwise.

## Integration hardening

1. Replace local login with Supabase Auth and bind staff roles to RLS claims.
2. Add Inngest functions for processor matching, capacity reminders, ready-for-pickup alerts, and 24–48 hour scorecard review.
3. Add Twilio sender service and opt-in/customer notification preferences.
4. Replace the visual route surface with Mapbox GL directions and geocoding.
5. Move the mock dashboard query/mutations to Supabase server actions and add audit-log pagination.
6. Add Playwright coverage for intake, exception resolution, driver check-in, processor handoff, and delivery confirmation.
