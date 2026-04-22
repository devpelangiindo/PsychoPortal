# Workspace

## Overview

pnpm workspace monorepo using TypeScript. This project contains two main products:
1. **Asesmen Platform** (`artifacts/asesmen-platform`) — Psychological assessment platform for Rumah Psikologi Pelangi Indonesia, served at `/`
2. **CMS Admin** (`artifacts/cms`) — Content Management System for pi-psychology.com marketing website, served at `/cms/`
3. **API Server** (`artifacts/api-server`) — Shared Express backend for both artifacts, served at `/api`

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
