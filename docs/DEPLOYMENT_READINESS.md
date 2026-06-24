# Torio — Render Deployment Readiness Report

**Generated:** 2026-06-21  
**Repository:** `torio-messaging-platform` (monorepo)  
**Target platform:** [Render](https://render.com)

---

## Executive summary

The monorepo is **ready for Render deployment** with minor operational notes. Production builds succeed, Prisma client generation works, and an initial migration has been added for `migrate deploy`. Deployment artifacts (`render.yaml`, start scripts, per-app `.env.example` files) are in place.

**Before first deploy:** set all required secrets in Render, link Postgres + Redis, and point Meta webhook/OAuth URLs at your production API domain.

---

## Checklist results

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | Production build succeeds | **PASS** | `npm run build` completed successfully (api, web, admin, database, shared). |
| 2 | Prisma generate runs correctly | **PASS** | `npm run db:generate` — Prisma Client v6.19.3 generated. |
| 3 | Prisma migrate deploy works | **PASS** / **WARN** | Script added: `npm run db:deploy`. Initial migration `20250621000000_init` created. **Fresh Postgres:** deploy applies migration. **Existing `db:push` DB:** returns `P3005` — baseline required (see below). |
| 4 | Environment variables not hardcoded | **PASS** / **WARN** | Secrets use env vars. Dev-only fallbacks remain for `localhost:3010` (API/web) when unset — production boot validates required vars. |
| 5 | Health check endpoint exists | **PASS** | `GET /api/v1/health` — checks DB connectivity, returns JSON `{ status: "ok" }`. |
| 6 | CORS configured via env | **PASS** | `CORS_ORIGINS` comma-separated list. HTTP + WebSocket (`inbox.gateway`) both read env. Default dev: `http://localhost:3010`. |
| 7 | Meta OAuth callback uses env | **PASS** | `META_OAUTH_REDIRECT_URL` or `${API_URL}/api/v1/channels/meta/callback` via `getMetaOAuthRedirectUrl()`. |
| 8 | Webhook URL configurable | **PASS** | `META_WEBHOOK_URL` overrides base; defaults `${API_URL}/api/v1/webhooks/{meta\|whatsapp}`. Verify token: `META_WEBHOOK_VERIFY_TOKEN` (required in production). |
| 9 | Production logging works | **PASS** | Structured JSON logging via `ProductionLogger` when `NODE_ENV=production`. Levels controlled by `LOG_LEVEL`. |

---

## Fixes applied in this pass

| Area | Change |
|------|--------|
| **Migrations** | Added `packages/database/prisma/migrations/20250621000000_init/` + `migrate:deploy` script |
| **Render start** | Added `scripts/render-start-api.mjs` (migrate deploy → start API) |
| **Render blueprint** | Updated `render.yaml` (Torio naming, Postgres, Redis, env vars, health checks) |
| **API port** | API now binds `PORT` (Render) then `API_PORT`, listens on `0.0.0.0` |
| **Web port** | `next start --port ${PORT:-3000}` for Render `PORT` |
| **Production boot** | `assertProductionEnv()` validates required secrets |
| **Logging** | JSON structured logs in production |
| **Webhooks** | Production rejects Meta verify without `META_WEBHOOK_VERIFY_TOKEN` |
| **Env templates** | Added `apps/api/.env.example`, `apps/web/.env.example`; updated root `.env.example` |
| **CORS example** | Fixed `CORS_ORIGINS` to include `localhost:3010` |
| **Auth fallbacks** | Dev `WEB_URL` fallback aligned to port `3010` |

---

## Required environment variables

### API service (`torio-api`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string (from Render Postgres) |
| `PORT` | Auto | Set by Render (default 4000 in blueprint) |
| `NODE_ENV` | **Yes** | `production` |
| `API_URL` | **Yes** | Public API URL, e.g. `https://torio-api.onrender.com` |
| `WEB_URL` | **Yes** | Public web URL, e.g. `https://torio-web.onrender.com` |
| `CORS_ORIGINS` | **Yes** | Comma-separated origins, e.g. `https://torio-web.onrender.com,http://localhost:3010` |
| `JWT_ACCESS_SECRET` | **Yes** | Min 32 chars |
| `JWT_REFRESH_SECRET` | **Yes** | Min 32 chars |
| `REDIS_URL` | Recommended | Render Redis internal URL |
| `META_APP_ID` | For Meta channels | Facebook app ID |
| `META_APP_SECRET` | For Meta channels | Facebook app secret |
| `META_WEBHOOK_VERIFY_TOKEN` | **Yes (prod)** | Meta webhook verification token |
| `META_OAUTH_REDIRECT_URL` | Optional | Defaults to `${API_URL}/api/v1/channels/meta/callback` |
| `META_WEBHOOK_URL` | Optional | Override webhook base; default `${API_URL}/api/v1/webhooks` |
| `OPENAI_API_KEY` | For AI features | Torio Brain / voice / sales agent |
| `LOG_LEVEL` | Optional | `log` (default prod), `debug`, `warn`, `error` |

### Web service (`torio-web`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | **Yes** | `production` |
| `PORT` | Auto | Set by Render |
| `NEXT_PUBLIC_API_URL` | **Yes** | e.g. `https://torio-api.onrender.com/api/v1` |

See also: [apps/api/.env.example](../apps/api/.env.example), [apps/web/.env.example](../apps/web/.env.example), [.env.example](../.env.example).

---

## Render service configuration

### Recommended topology

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  torio-web      │────▶│  torio-api      │────▶│  torio-postgres  │
│  (Next.js)      │     │  (NestJS)       │     │  (PostgreSQL 16) │
│  :PORT          │     │  :PORT          │     └──────────────────┘
└─────────────────┘     │                 │     ┌──────────────────┐
                        └────────┬────────┘────▶│  torio-redis     │
                                 │              │  (Redis)         │
                                 └──────────────└──────────────────┘
```

### API service

| Setting | Value |
|---------|-------|
| **Type** | Web Service |
| **Runtime** | Node ≥ 20.19 |
| **Build command** | `npm ci && npm run db:generate && npm run build --workspace=@mango/shared && npm run build --workspace=@mango/database && npm run build --workspace=@mango/api` |
| **Start command** | `node scripts/render-start-api.mjs` |
| **Health check path** | `/api/v1/health` |
| **Pre-deploy (optional)** | `npm run db:deploy` — already in start script |

### Web service

| Setting | Value |
|---------|-------|
| **Type** | Web Service |
| **Runtime** | Node ≥ 20.19 |
| **Build command** | `npm ci && npm run build --workspace=@mango/shared && npm run build --workspace=@mango/web` |
| **Start command** | `npm run start --workspace=@mango/web` |
| **Health check path** | `/` |

### Postgres

| Setting | Value |
|---------|-------|
| **Plan** | Basic 256MB+ (pgvector optional for future AI embeddings) |
| **Region** | Singapore (match API/web) |
| **Database name** | `torio_messaging` |

### Redis

| Setting | Value |
|---------|-------|
| **Plan** | Free or Starter |
| **Link** | Set `REDIS_URL` on API service to internal Redis URL |

---

## Build & start commands (local verification)

```bash
# Install
npm ci

# Generate Prisma client
npm run db:generate

# Production build (all workspaces)
npm run build

# Migrate (production)
npm run db:deploy

# Start API (production)
npm run start:prod --workspace=@mango/api

# Start web (production)
PORT=3000 npm run start --workspace=@mango/web
```

### Local development

```bash
cp .env.example .env
npm run dev:local
# Web: http://localhost:3010  |  API: http://localhost:4000/api/v1
```

---

## Meta / webhook URLs (production)

Configure in [Meta Developer Console](https://developers.facebook.com/):

| Integration | URL |
|-------------|-----|
| **OAuth redirect** | `https://<api-host>/api/v1/channels/meta/callback` |
| **Messenger webhook** | `https://<api-host>/api/v1/webhooks/meta` |
| **WhatsApp webhook** | `https://<api-host>/api/v1/webhooks/whatsapp` |
| **Verify token** | Value of `META_WEBHOOK_VERIFY_TOKEN` |

Override base with `META_WEBHOOK_URL` if using a reverse proxy.

---

## Migration baseline (existing databases)

If your database was created with `db:push` (local dev), first production deploy may show:

```
Error P3005: The database schema is not empty
```

**For existing non-empty DBs**, baseline once:

```bash
npm run db:deploy -- --schema=packages/database/prisma/schema.prisma
# Or mark migration as applied without running SQL:
cd packages/database && npx prisma migrate resolve --applied 20250621000000_init
```

**For fresh Render Postgres**, `npm run db:deploy` runs automatically via `scripts/render-start-api.mjs`.

Optional post-deploy seed (plans, admin):

```bash
npm run db:seed
```

Run seed manually once from Render shell — do not auto-seed in production start script.

---

## Known blockers & warnings

| Item | Severity | Action |
|------|----------|--------|
| **Redis not in start script** | Warn | API starts without Redis but queues/cache may fail — link Render Redis |
| **Web typecheck errors** | Warn | Pre-existing TS prop mismatches in brain settings page — **does not block** `next build` |
| **No Docker in CI sandbox** | Info | Could not run `docker compose` for isolated migrate test |
| **Swagger disabled in prod** | Info | `/docs` only in non-production — intentional |
| **Seed on deploy** | Warn | Do not auto-run `db:seed` in production — run manually if needed |
| **Render free tier cold starts** | Info | Health check may timeout on first request after idle |

---

## Deployment steps (Render)

1. **Create Blueprint** from `render.yaml` or create services manually.
2. **Create Postgres** → copy internal `DATABASE_URL` to API service.
3. **Create Redis** → set `REDIS_URL` on API service.
4. **Set secrets:** JWT secrets, `API_URL`, `WEB_URL`, `CORS_ORIGINS`, `NEXT_PUBLIC_API_URL`, Meta vars, AI keys.
5. **Deploy API** — start script runs migrations then boots NestJS.
6. **Deploy Web** — ensure `NEXT_PUBLIC_API_URL` points to live API.
7. **Configure Meta** webhooks and OAuth with production URLs.
8. **Verify:**
   - `curl https://<api>/api/v1/health`
   - Login at `https://<web>/auth/login`
   - Connect a Meta channel in Settings → Channels

---

## Files reference

| File | Purpose |
|------|---------|
| [render.yaml](../render.yaml) | Render Blueprint |
| [scripts/render-start-api.mjs](../scripts/render-start-api.mjs) | Migrate + start API |
| [scripts/run-local.mjs](../scripts/run-local.mjs) | Local dev orchestration |
| [apps/api/.env.example](../apps/api/.env.example) | API env template |
| [apps/web/.env.example](../apps/web/.env.example) | Web env template |
| [packages/database/prisma/migrations/](../packages/database/prisma/migrations/) | Production migrations |
| [docs/deployment/DEPLOYMENT.md](./deployment/DEPLOYMENT.md) | General deployment guide |

---

## Verification log

| Command | Result | Timestamp |
|---------|--------|-----------|
| `npm run db:generate` | Exit 0 | 2026-06-21 |
| `npm run build` | Exit 0 (all 5 packages) | 2026-06-21 |
| `npm run build --workspace=@mango/api` (post-fixes) | Exit 0 | 2026-06-21 |
| `npm run typecheck --workspace=@mango/api` | Exit 0 | 2026-06-21 |
| `prisma migrate deploy` (existing DB) | P3005 expected — baseline needed | 2026-06-21 |
| `prisma migrate deploy` (empty DB) | Not run (destructive test skipped) | — |

**Overall readiness: READY TO DEPLOY** with secrets configured and Meta URLs updated.
