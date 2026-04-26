# Workspace

## Overview

pnpm workspace monorepo using TypeScript. This project contains four main products:
1. **Marketing Website** (`artifacts/marketing-site`) — Public marketing site for Pelangi Indonesia Group (pi-psychology.com), served at `/`
2. **Asesmen Platform** (`artifacts/asesmen-platform`) — Psychological assessment platform, served at `/asesmen`
3. **CMS Admin** (`artifacts/cms`) — Payload CMS for content management, served at `/admin`
4. **API Server** (`artifacts/api-server`) — Shared Express backend, served at `/api`

## Marketing Website (`artifacts/marketing-site`)

React + Vite + Tailwind CSS marketing site for Pelangi Indonesia Group:
- **Brand colors**: Deep green #1B4332 (primary), mid green #2D6A4F, fresh green #52B788, terracotta #9A6E5E, gold #D4AC0D
- **Fonts**: Plus Jakarta Sans (headings + body), Lora (serif/blockquotes)
- **Pages**: `/` (Homepage), `/tentang-kami`, `/produk-layanan`, `/produk-layanan/:slug`, `/artikel`, `/artikel/:slug`, `/kontak`
- **All content is hardcoded** (no CMS integration yet)
- Contact: WA Bantul +62 816-669-533, WA Colombo +62 811-256-238, email info@pi-education.com
- Social: @rumahpsikologi_pi (Instagram), @pelangi_indonesia (TikTok)

## CMS Admin (pi-psychology.com)

Payload CMS (Next.js) for the pi-psychology.com marketing website, served at `/admin`:
- **Collections**: Pages, Blog & Artikel (Posts), Tim (Team Members), Layanan (Services), Media
- **Authentication**: Payload CMS built-in user auth (`cms-users` collection)
- **Database schema**: Uses PostgreSQL with `cms` schema prefix
- **Image Uploads**: Uses Replit Object Storage (GCS) via `@payloadcms/storage-gcs`
  - All media uploads go to GCS bucket (env: `DEFAULT_OBJECT_STORAGE_BUCKET_ID`)
  - Files are publicly accessible (`acl: 'Public'`)
  - Authenticated via Replit sidecar at `http://127.0.0.1:1106`
- **Payload admin routes**: `/admin` (admin panel), `/admin/api` (Payload REST API)
- **Image fields**: All content collections have `type: 'upload'` fields linked to the `media` collection

### CMS CSS Architecture (important)

The Payload admin uses a sub-path setup (`assetPrefix: '/admin'`, `basePath: '/admin'`):
- CSS is loaded via `import '@payloadcms/next/css'` in `src/app/layout.tsx` — the official package export that Next.js bundles as a proper `<link>` stylesheet
- Hydration mismatch (React 19 throws on `data-theme` attribute change) is suppressed via `admin.suppressHydrationWarning: true` in `payload.config.ts`
- The asesmen-platform Vite proxy at `"/_next"` forwards bare `/_next/...` requests to CMS (port 23740) to fix HMR routing in dev
- Admin creds: `admin@pi-psychology.com` / `AdminCMS2025!`

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
