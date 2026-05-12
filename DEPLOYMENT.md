# Render Deployment

This repo is prepared for Render Blueprint deploys with `render.yaml`.

## Services

- `psychoportal-api`: Express API, Midtrans callbacks, booking/assessment auth
- `psychoportal-cms`: Payload CMS at `/admin`
- `psychoportal-marketing`: public marketing site
- `psychoportal-asesmen`: asesmen and booking frontend under `/asesmen`
- `psychoportal-db`: shared Postgres database

## Before First Deploy

1. Push the repo to GitHub.
2. In Render, create a new Blueprint from this repo.
3. Render will ask for `sync: false` secrets. Fill:
   - `MIDTRANS_PRODUCTION_SERVER_KEY`
   - `MIDTRANS_PRODUCTION_CLIENT_KEY`
   - `MIDTRANS_PRODUCTION_MERCHANT_ID`
   - `VITE_MIDTRANS_PRODUCTION_CLIENT_KEY`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - email SMTP vars if contact/OTP email should send real email
4. If Render assigns different service URLs, update these env vars in Render:
   - API: `PAYLOAD_PUBLIC_SERVER_URL`
   - CMS: `PAYLOAD_PUBLIC_SERVER_URL`
   - Marketing: `VITE_CMS_BASE_URL`, `VITE_ASESMEN_PLATFORM_URL`
   - Asesmen: `VITE_API_BASE_URL`, `VITE_MAIN_SITE_URL`
5. In Midtrans dashboard, configure the payment notification/webhook URL:
   - `https://psychoportal-api.onrender.com/api/midtrans/webhook`
   - Replace the hostname if Render/custom domain differs.

## Notes

- The API start command runs `pnpm --filter @workspace/db run push` before booting, so a fresh Render Postgres database gets the Drizzle schema.
- The CMS uses the same Postgres instance with Payload's `cms` schema.
- For production CMS uploads, prefer object storage. Leaving `DEFAULT_OBJECT_STORAGE_BUCKET_ID` empty uses local filesystem storage, which is not suitable for long-term media persistence on standard Render web services.
- Static frontend routes are rewritten to `index.html` so browser refreshes on client-side routes work.

## Local Build Checks

```bash
pnpm --filter @workspace/api-server run build
PORT=8084 BASE_PATH=/asesmen/ VITE_API_BASE_URL=https://psychoportal-api.onrender.com VITE_MAIN_SITE_URL=https://psychoportal-marketing.onrender.com VITE_MIDTRANS_PRODUCTION_CLIENT_KEY=placeholder pnpm --filter @workspace/asesmen-platform run build
PORT=8081 BASE_PATH=/ VITE_CMS_BASE_URL=https://psychoportal-cms.onrender.com VITE_ASESMEN_PLATFORM_URL=https://psychoportal-asesmen.onrender.com/asesmen/ pnpm --filter @workspace/marketing-site run build
pnpm --filter @workspace/cms run build
```
