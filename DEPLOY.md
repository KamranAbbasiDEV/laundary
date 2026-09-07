# Deploy JotNexus to jotnexus.com

## Quick deploy (free)

### Cloudflare Pages (recommended)
1. Push this repo to GitHub
2. Cloudflare Dashboard → Pages → Create project → Connect Git
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add custom domain `jotnexus.com` and `www.jotnexus.com`

### Netlify
1. Connect repo or drag-drop the `dist/` folder
2. Uses `netlify.toml` automatically

### Vercel
1. Import repo — uses `vercel.json` automatically

## Before launch checklist

1. **AdSense** — Replace `ca-pub-XXXXXXXXXXXXXXXX` in `data/site.json` with your real publisher ID after approval
2. **Google Search Console** — Add property for `https://www.jotnexus.com` and submit `/sitemap.xml`
3. **DNS** — Point domain to your host (Cloudflare/Netlify/Vercel)
4. **Email** — Set up `hello@jotnexus.com` for contact (Cloudflare Email Routing is free)

## Local preview

```bash
npm run build
npm run preview
```

Open http://localhost:3000

## Add more tools

1. Add entry to `data/tools.json` with `"status": "live"`
2. Implement `JotTools['your-id']` in `src/assets/js/tools/all-tools.js`
3. Run `npm run build`
