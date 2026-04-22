# Workspace

## Overview

pnpm workspace monorepo using TypeScript. This project contains two main products:
1. **Asesmen Platform** (`artifacts/asesmen-platform`) — Psychological assessment platform for Rumah Psikologi Pelangi Indonesia, served at `/`
2. **CMS Admin** (`artifacts/cms`) — Content Management System for pi-psychology.com marketing website, served at `/cms/`
3. **API Server** (`artifacts/api-server`) — Shared Express backend for both artifacts, served at `/api`

## CMS Admin (pi-psychology.com)

The CMS admin panel allows authorized admin/internal users to manage marketing website content:
- **Collections**: Pages, Blog & Artikel (Posts), Tim (Team Members), Layanan (Services)
- **Authentication**: Uses same JWT auth as asesmen platform (admin/internal role required)
- **Database tables**: `cms_pages`, `cms_posts`, `cms_team_members`, `cms_services`
- **API routes**: `/api/cms/pages`, `/api/cms/posts`, `/api/cms/team-members`, `/api/cms/services`, `/api/cms/stats`
- **Preview path**: `/cms/` — Login at `/cms/login`

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
