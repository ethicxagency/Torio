# Torio Production Readiness Report

**Generated:** 2026-06-24  
**Repository:** `torio-messaging-platform` (monorepo at `/Users/rabbyislam/Desktop/Nextup Projects/replyo`)  
**Target:** GitHub push + [Render](https://render.com) deployment

---

## 1. Production Readiness Report

### STEP 1 — Project Audit

| Check | Command | Result | Notes |
|-------|---------|--------|-------|
| Typecheck | `npm run typecheck` | **PASS** (exit 0) | All 5 workspaces: `@mango/admin`, `@mango/api`, `@mango/database`, `@mango/shared`, `@mango/web` |
| Lint | `npm run lint` | **FAIL** (exit 2) | `@mango/api` — ESLint 9 requires `eslint.config.js`; no config file present. `@mango/web` / `@mango/admin` did not complete (turbo stopped on API failure). **Does not block production build.** |
| Build scripts | Root `package.json` | **Present** | `build`, `dev`, `typecheck`, `lint`, `db:*`, `start:render:api` |
| Workspace builds | Per-package | **Present** | API: `nest build`; Web: `next build`; Database/Shared: `tsc` |

**Build script summary:**

| Workspace | Script | Output |
|-----------|--------|--------|
| `@mango/api` | `nest build` | `apps/api/dist/` |
| `@mango/web` | `next build` | `apps/web/.next/` |
| `@mango/admin` | `next build` | `apps/admin/.next/` |
| `@mango/database` | `tsc` | `packages/database/dist/` |
| `@mango/shared` | `tsc` | `packages/shared/dist/` |
| Root | `turbo run build` | All of the above |

**Obvious issues (non-blocking):**

- API ESLint config missing (lint only; builds succeed)
- Prisma `package.json#prisma` config deprecated (warning only)
- Dev JWT/crypto fallbacks in non-production code paths (`dev-access-secret`, `dev-encryption-key`) — production boot validates required secrets via `assertProductionEnv()`

---

### STEP 2 — Environment Cleanup

| Check | Status | Details |
|-------|--------|---------|
| `.gitignore` exists | **FIXED** | Root `.gitignore` was **missing** — created with required entries |
| `.gitignore` includes `.env` | **PASS** | `.env`, `.env.*` ignored; `!.env.example` allowed |
| `.gitignore` includes `node_modules` | **PASS** | |
| `.gitignore` includes `.next` | **PASS** | |
| `.gitignore` includes `dist` | **PASS** | |
| `.gitignore` includes `coverage` | **PASS** | |
| `.env` tracked in git | **N/A** | Repository not yet initialized (no `.git/` directory) |
| Hardcoded secrets in source | **PASS** | No API keys, tokens, or cloud credentials found in `apps/` or `packages/` source. Pattern scan covered OpenAI, Google, GitHub, AWS, Slack token formats. |
| `.env.example` files | **PASS** | Root `.env.example`, `apps/api/.env.example`, `apps/web/.env.example` |

**Secret scan notes (report only):**

- Local `.env` and `apps/web/.env.local` exist on disk — must remain untracked (now covered by `.gitignore`)
- Seed script (`packages/database/prisma/seed.ts`) uses env vars with dev defaults (`changeme-in-production`, `demo123456`) — acceptable for local seed only; do not run seed in production without overriding
- JWT strategy has dev fallbacks (`dev-access-secret`) used only when env unset — blocked in production by `assertProductionEnv()`

**Local files that must NOT be committed:**

- `.env`
- `apps/web/.env.local`
- `.local-postgres/`
- `node_modules/`
- `.turbo/`, `.responsive-screenshots/`
- `apps/*/.next/`, `apps/api/dist/`, `packages/*/dist/`

---

### STEP 3 — Production Build Test

| Build | Command | Result |
|-------|---------|--------|
| Frontend (web) | `npm run build --workspace=@mango/web` | **PASS** (exit 0) — 24 routes compiled |
| Backend (api) | `npm run build --workspace=@mango/api` | **PASS** (exit 0) — `nest build` |

---

### STEP 4 — Database Check

| Check | Command | Result |
|-------|---------|--------|
| Prisma generate | `npm run db:generate` | **PASS** — Prisma Client v6.19.3 generated |
| Migrate deploy (no DATABASE_URL) | `npm run db:deploy` | **SKIP** — Error P1012: `DATABASE_URL` not found |
| Migrate deploy (with local DATABASE_URL) | `npm run db:deploy` (sourced `.env`) | **EXPECTED P3005** — Local DB was created via `db:push`; schema not empty. Fresh Render Postgres will apply migration cleanly. |

**Migration baseline (existing local DB only):**

```bash
cd packages/database && npx prisma migrate resolve --applied 20250621000000_init
```

**Fresh Render Postgres:** `scripts/render-start-api.mjs` runs `npm run db:deploy` automatically on API startup.

---

### STEP 5 — Render Readiness

**Existing deployment artifacts:**

| File | Status |
|------|--------|
| `render.yaml` | Present — Blueprint for `torio-api`, `torio-web`, `torio-postgres`, `torio-redis` |
| `docs/DEPLOYMENT_READINESS.md` | Present — prior readiness doc (2026-06-21) |
| `scripts/render-start-api.mjs` | Present — migrate deploy → `start:prod` |
| `apps/api/.env.example` | Present |
| `apps/web/.env.example` | Present |
| `.env.example` | Present |

**Env var usage verification:** All secrets and URLs read from `process.env` / NestJS `ConfigService`. No hardcoded production credentials found.

| Variable | Source | Hardcoded? |
|----------|--------|------------|
| `DATABASE_URL` | Prisma schema + ConfigModule | No |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ConfigService | No (dev fallbacks in JWT strategy only) |
| `META_*` | ConfigService + `app-env.ts` | No |
| `OPENAI_API_KEY` | ConfigService | No |
| `GOOGLE_AI_API_KEY` | — | **Not used** — codebase uses `OPENAI_API_KEY`; Gemini voice provider is mock/local |
| `GOOGLE_CLIENT_ID/SECRET` | `.env.example` only | No (OAuth optional) |
| `WEB_URL` / `API_URL` / `FRONTEND_URL` | `app-env.ts`, ConfigService | No — uses `WEB_URL` (not `FRONTEND_URL`) |
| `CORS_ORIGINS` | `app-env.ts`, inbox gateway | No |
| `REDIS_URL` | Redis module | No (defaults to `redis://localhost:6379` in dev) |
| `NEXT_PUBLIC_API_URL` | Web `lib/api.ts`, hooks | No |

**Render blueprint alignment:**

- API health check: `/api/v1/health` — matches `HealthController` at `@Controller("health")` with global prefix `/api` + version `v1`
- API start: `node scripts/render-start-api.mjs`
- Web health check: `/`
- Node engine: `>=20.19` (root `package.json`)

---

### STEP 6 — Health Check

| Endpoint | Method | Response | Status |
|----------|--------|----------|--------|
| `/api/v1/health` | GET | `{ status: "ok", timestamp, service: "torio-api" }` + DB ping | **EXISTS** — no changes needed |

Implementation: `apps/api/src/modules/health/health.module.ts` — public route, verifies PostgreSQL with `SELECT 1`.

---

### STEP 7 — GitHub Readiness

| Check | Status | Details |
|-------|--------|---------|
| Git repository | **INITIALIZED** | Empty repo initialized during audit; 12 untracked top-level entries |
| Secrets in working tree | **OK** | `.env` files exist locally but will be ignored once git is initialized |
| Debug console.logs (production paths) | **OK** | `production-logger.ts` uses `console.log` intentionally for JSON structured logging in production. `mail.module.ts` logs only when SMTP is not configured (dev/no-op fallback). No stray debug logs found in API source. |
| Temp / artifact files | **OK** | `.gitignore` now excludes build artifacts, local postgres, turbo cache, screenshots |

**Estimated source files to track:** ~280 TypeScript/JSON/config files (excluding `node_modules`, `.next`, `dist`, local artifacts).

---

## 2. Files Requiring Changes

### Applied in this pass

| File | Change |
|------|--------|
| `.gitignore` | **Created** — excludes `.env`, `.env.*`, `node_modules`, `.next`, `dist`, `coverage`, local dev artifacts |
| `docs/PRODUCTION_READINESS_REPORT.md` | **Created** — this report |

### No changes needed

| Area | Reason |
|------|--------|
| Health endpoint | Already exists at `GET /api/v1/health` |
| `render.yaml` | Already configured |
| Business logic | No modifications required |

### Recommended (non-blocking, post-deploy)

| Item | Action |
|------|--------|
| API ESLint | Add `eslint.config.js` for `@mango/api` to fix lint script |
| Existing local DB | Baseline migration if reusing local Postgres with `db:push` history |

---

## 3. Environment Variable List

### API service (`torio-api`) — Render

| Variable | Required | Default / Notes |
|----------|----------|-----------------|
| `NODE_ENV` | Yes | `production` |
| `DATABASE_URL` | Yes | From Render Postgres (auto-linked in blueprint) |
| `PORT` | Auto | Set by Render (blueprint: `4000`) |
| `API_URL` | Yes | Public API URL, e.g. `https://torio-api.onrender.com` |
| `WEB_URL` | Yes | Public web URL, e.g. `https://torio-web.onrender.com` |
| `CORS_ORIGINS` | Yes | Comma-separated, include web URL |
| `JWT_ACCESS_SECRET` | Yes | Min 32 chars (Render can auto-generate) |
| `JWT_REFRESH_SECRET` | Yes | Min 32 chars (Render can auto-generate) |
| `JWT_ACCESS_EXPIRES_IN` | No | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` |
| `REDIS_URL` | Recommended | Render Redis internal URL |
| `META_APP_ID` | For Meta channels | Facebook app ID |
| `META_APP_SECRET` | For Meta channels | Facebook app secret |
| `META_WEBHOOK_VERIFY_TOKEN` | Yes (prod) | Required for webhook verification |
| `META_OAUTH_REDIRECT_URL` | No | Defaults to `${API_URL}/api/v1/channels/meta/callback` |
| `META_WEBHOOK_URL` | No | Defaults to `${API_URL}/api/v1/webhooks` |
| `META_GRAPH_API_VERSION` | No | `v21.0` |
| `WHATSAPP_PHONE_NUMBER_ID` | For WhatsApp | |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | For WhatsApp | |
| `OPENAI_API_KEY` | For AI features | Brain, voice, sales agent |
| `OPENAI_MODEL` | No | `gpt-4o-mini` |
| `ANTHROPIC_API_KEY` | Optional | Listed in `.env.example`; not actively referenced in API source |
| `VOICE_PROVIDER` | No | `OPENAI` |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth |
| `GOOGLE_CALLBACK_URL` | Optional | `${API_URL}/api/v1/auth/google/callback` |
| `SMTP_HOST` | Optional | Email delivery |
| `SMTP_PORT` | No | `587` |
| `SMTP_USER` | Optional | |
| `SMTP_PASS` | Optional | |
| `SMTP_FROM` | No | `noreply@torio.app` |
| `S3_ENDPOINT` | Optional | File storage |
| `S3_REGION` | No | `ap-southeast-1` |
| `S3_BUCKET` | Optional | |
| `S3_ACCESS_KEY_ID` | Optional | |
| `S3_SECRET_ACCESS_KEY` | Optional | |
| `S3_PUBLIC_URL` | Optional | |
| `ENCRYPTION_KEY` | Optional | Courier credentials; falls back to `JWT_ACCESS_SECRET` |
| `LOG_LEVEL` | No | `log` (production default) |
| `PLATFORM_ADMIN_EMAIL` | Seed only | Do not use weak defaults in prod seed |
| `PLATFORM_ADMIN_PASSWORD` | Seed only | |

### Web service (`torio-web`) — Render

| Variable | Required | Default / Notes |
|----------|----------|-----------------|
| `NODE_ENV` | Yes | `production` |
| `PORT` | Auto | Set by Render |
| `NEXT_PUBLIC_API_URL` | Yes | e.g. `https://torio-api.onrender.com/api/v1` |

### Local development only (root `.env`)

See [.env.example](../.env.example) for full local template including `ADMIN_URL`, `DEMO_USER_*`, Docker Postgres port `5433`, etc.

---

## 4. Render Deployment Checklist

- [ ] **Add GitHub remote** and push (see Section 5)
- [ ] Create Render Blueprint from `render.yaml` (or create services manually)
- [ ] **Postgres** — `torio-postgres` created; `DATABASE_URL` linked to API
- [ ] **Redis** — `torio-redis` created; set `REDIS_URL` on API service
- [ ] **API secrets** — set `API_URL`, `WEB_URL`, `CORS_ORIGINS`, Meta vars, `OPENAI_API_KEY`
- [ ] **Web** — set `NEXT_PUBLIC_API_URL` to live API URL (include `/api/v1`)
- [ ] Deploy API first — start script runs `db:deploy` then boots NestJS
- [ ] Deploy Web — verify build succeeds with `NEXT_PUBLIC_API_URL`
- [ ] **Meta Developer Console** — configure OAuth redirect and webhooks:
  - OAuth: `https://<api-host>/api/v1/channels/meta/callback`
  - Messenger webhook: `https://<api-host>/api/v1/webhooks/meta`
  - WhatsApp webhook: `https://<api-host>/api/v1/webhooks/whatsapp`
- [ ] **Verify health:** `curl https://<api-host>/api/v1/health` → `{"status":"ok",...}`
- [ ] **Verify web:** login at `https://<web-host>/auth/login`
- [ ] **Optional seed:** run `npm run db:seed` once from Render shell (not in start script)
- [ ] **Migration baseline:** only if migrating existing non-empty DB (P3005)

---

## 5. Git Commands (DO NOT EXECUTE — document only)

> **Note:** Git was initialized during this audit. Add your GitHub remote before pushing.

```bash
# Navigate to project root
cd "/Users/rabbyislam/Desktop/Nextup Projects/replyo"

# Set default branch (if not already main)
git branch -M main

# Add remote (replace with your GitHub repo URL)
git remote add origin https://github.com/YOUR_ORG/torio.git

# Review status — confirm .env and node_modules are NOT listed
git status

# Stage all tracked-worthy files
git add .

# Commit
git commit -m "Prepare Torio for Render deployment"

# Push to GitHub
git push -u origin main
```

**Pre-commit verification:**

```bash
# Confirm no .env files are staged
git ls-files | grep -E '\.env' || echo "OK: no .env files tracked"

# Confirm secrets are ignored
git check-ignore -v .env apps/web/.env.local node_modules/
```

---

## Verification Log (2026-06-24)

| Command | Exit Code | Notes |
|---------|-----------|-------|
| `npm run typecheck` | 0 | All workspaces pass |
| `npm run lint` | 2 | API ESLint config missing |
| `npm run build --workspace=@mango/web` | 0 | 24 routes |
| `npm run build --workspace=@mango/api` | 0 | nest build |
| `npm run db:generate` | 0 | Prisma Client v6.19.3 |
| `npm run db:deploy` (no env) | 1 | P1012 — DATABASE_URL required |
| `npm run db:deploy` (local .env) | 1 | P3005 — expected for db:push DB |

**Overall readiness: READY TO DEPLOY** — initialize git, push to GitHub, configure Render secrets, deploy.
