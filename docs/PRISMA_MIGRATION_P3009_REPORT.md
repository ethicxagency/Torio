# Prisma P3009 Migration Failure — Report

**Error:** `P3009 — A previous migration failed: 20250621000000_init`  
**Date:** June 2026

---

## Root cause

The init migration file was **corrupted with npm CLI output** at the top of the SQL file:

```text
npm warn Unknown env config "devdir"...
warn The configuration property `package.json#prisma` is deprecated...
For more information, see: https://pris.ly/prisma-config
```

These lines were accidentally prepended when the migration was generated (stdout/stderr redirect error). PostgreSQL cannot execute them as SQL, so **`20250621000000_init` failed immediately** on Render.

Prisma records failed migrations in `_prisma_migrations` with status `failed`. All later deploys fail with **P3009** until the failure is resolved.

---

## Migration audit

| Order | Migration | Status |
|-------|-----------|--------|
| 1 | `20250621000000_init` | **Was broken** — npm lines removed |
| 2 | `20250624000000_add_courier_policies_custom_memory` | Valid SQL |

Migration order is correct (init → courier/policies/custom memory).

---

## Fixes applied

| Change | File |
|--------|------|
| Removed npm warning lines from migration SQL | `prisma/migrations/20250621000000_init/migration.sql` |
| Added `resolve-failed-init` script | `packages/database/package.json` |
| Added `db:resolve-failed-init` root script | `package.json` |
| P3009 auto-recovery on startup (resolve + retry deploy) | `scripts/render-start-api.mjs` |

---

## Render recovery (production)

After deploying the fixed code, choose **one** option:

### Option A — Recommended if database has no important data

1. Render Dashboard → **torio-postgres** → **Reset Database**
2. Redeploy **torio-api** (runs `migrate deploy` on empty DB)

Both migrations apply cleanly on a fresh database.

### Option B — Keep database, clear failed migration record

Run once (Render Shell or locally with production `DATABASE_URL`):

```bash
npm run db:resolve-failed-init
npm run db:deploy
```

This marks `20250621000000_init` as rolled back, then re-applies all migrations with the fixed SQL.

**Note:** If the failed migration partially applied objects before failing, you may still need Option A.

The updated `render-start-api.mjs` attempts Option B automatically if the first `db:deploy` fails.

---

## Development reset strategy

Local DB was likely created with `db:push` (not migrations), which causes **P3005** on `migrate deploy`.

**Safest local reset:**

```bash
# Stop app, then reset local Postgres (docker-compose or embedded postgres)
npm run db:push -- --force-reset   # dev only — wipes data

# Or use migrations on a clean database:
dropdb mango_messaging && createdb mango_messaging
npm run db:deploy
npm run db:seed   # optional
```

**Do not** use `--force-reset` on production Render Postgres.

---

## Verification checklist

- [x] Init migration starts with valid SQL (`-- CreateSchema`)
- [x] Second migration has valid SQL
- [x] Migration order: init → add_courier_policies_custom_memory
- [x] Fresh DB path documented (reset + deploy)
- [x] P3009 recovery path documented (`db:resolve-failed-init`)

---

## Prevention

When generating migrations, always use:

```bash
npm run db:migrate --workspace=@mango/database
```

Never redirect stderr into migration files. Commit only the generated `migration.sql` from `prisma/migrations/<timestamp>_<name>/`.
