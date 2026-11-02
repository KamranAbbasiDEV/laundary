# Laundry Dispatch

Laundry Dispatch is a Next.js 16 operations workspace for managing laundry orders, drivers, processors, routes, deadlines, notifications, payments, and workflow exceptions.

## Recent changes

- Refined the dispatch workspace UI, including order views, kanban workflows, toolbar controls, notifications, deadline badges, and branding.
- Added client branding assets, Saans and DM Sans fonts, icons, and dedicated workspace styles.
- Updated the order detail API route and synchronized generated Next.js route type references.
- Fixed the tool audit script so it scans every generated tool bundle and recognizes dynamic registrations.
- Validated the project with TypeScript, a production build, the tool audit, and a jsdom smoke test covering all 408 tools.
- Excluded generated `.next-stale*` build caches from Git so they are not committed or uploaded.

## Development

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

## Verification

```bash
npm run lint
npm run build
node scripts/check-tools.js
node scripts/smoke-test.js
```

## Deployment

The repository is hosted at [KamranAbbasiDEV/laundary](https://github.com/KamranAbbasiDEV/laundary). The production branch is `main`.
