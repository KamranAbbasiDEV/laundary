# Deploy RinseLine Dispatch for client testing

This app is a Next.js server application. For a dummy-data client review, deploy it to Vercel with no environment variables. The app intentionally falls back to local demo behavior when Supabase, Twilio, Mapbox, and Inngest credentials are absent.

## Recommended: Vercel preview deployment

1. Push the repository to GitHub.
2. In Vercel, choose **Add New Project** and import the repository.
3. Keep the detected framework as **Next.js**.
4. Leave the environment-variable section empty for this demo deployment.
5. Deploy and copy the generated `https://...vercel.app` URL.
6. Share the `/login` URL with the client.

The repository’s [vercel.json](./vercel.json) only overrides the build command. Vercel manages the Next.js `.next` output automatically; do not configure `dist` as the output directory.

## Client demo access

For this temporary review build, use:

- Email: `demo@rinseline.test`
- Password: `demo1234`

Without Supabase variables, the minimal login accepts any valid email and a password of at least four characters. This is demo-only behavior and must not be used for a production deployment.

Open the workspace, then review **Orders**, **Dispatch**, **Processors**, **Routes**, **Driver app**, **Processor portal**, and **Reports**. Use the order detail actions to exercise pickup, processor pickup, and delivery transitions.

## Important demo limitations

- Demo data is seeded in the browser UI. It is not a shared multi-user database.
- API writes use a local fallback when integration credentials are absent; serverless instances may not retain those writes after a cold start.
- Photos, SMS, maps, Supabase Auth, background jobs, and RLS are not live until their credentials and database setup are added.
- Never enter real customer names, phone numbers, addresses, photos, or credentials into this review deployment.

## Before production

Create a separate production deployment and add the variables listed in [.env.example](./.env.example). Then run the SQL in [supabase/schema.sql](./supabase/schema.sql), configure Supabase Auth and Storage, and verify Twilio, Mapbox, and Inngest independently before accepting real orders.

## Local verification

```bash
npm run build
npm run start
```

Open http://localhost:3000
