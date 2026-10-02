# Render Deployment

This repo is prepared for Render Blueprint deploys with `render.yaml`.

## Services

- `psychoportal-api`: Express API, Midtrans callbacks, booking/assessment auth
- `psychoportal-marketing`: public marketing site
- `psychoportal-asesmen`: asesmen and booking frontend
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
   - Marketing: `VITE_ASESMEN_PLATFORM_URL`
   - Asesmen: `VITE_API_BASE_URL`, `VITE_MAIN_SITE_URL`
5. In Midtrans dashboard, configure the payment notification/webhook URL:
   - `https://psychoportal-api-k3k5.onrender.com/api/midtrans/webhook`
   - Replace the hostname if Render/custom domain differs.

## Notes

- The API start command runs `pnpm --filter @workspace/db run push` before booting, so a fresh Render Postgres database gets the Drizzle schema.
- The Payload CMS is intentionally not deployed in this blueprint to keep launch costs down. CMS-backed content will fall back to the static content already in the frontends.
- If a CMS is needed later, restore the `psychoportal-cms` service in `render.yaml` and set `VITE_CMS_BASE_URL` on the marketing site plus `PAYLOAD_PUBLIC_SERVER_URL` on the API.
- Static frontend routes are rewritten to `index.html` so browser refreshes on client-side routes work.

## Local Build Checks

```bash
pnpm --filter @workspace/api-server run build
PORT=8084 BASE_PATH=/ VITE_API_BASE_URL=https://psychoportal-api-k3k5.onrender.com VITE_MAIN_SITE_URL=https://pi-psychology.com VITE_MIDTRANS_PRODUCTION_CLIENT_KEY=placeholder pnpm --filter @workspace/asesmen-platform run build
PORT=8081 BASE_PATH=/ VITE_ASESMEN_PLATFORM_URL=https://asesmen.pi-psychology.com pnpm --filter @workspace/marketing-site run build
```
