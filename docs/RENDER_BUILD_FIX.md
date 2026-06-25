# Render Build Fix — Turbo Not Found

**Issue:** `sh: 1: turbo: not found` on Render.

## Root cause

Render sets `NODE_ENV=production`. With default npm behavior, `npm ci` skips `devDependencies`. Turbo was originally in `devDependencies`, so `node_modules/.bin/turbo` was missing when build scripts ran `turbo run build`.

## Changes

| File | Change |
|------|--------|
| `package.json` | Moved `turbo` to **`dependencies`** |
| `package.json` | `build:render:api` → `npm run db:generate && turbo run build --filter=@mango/api...` |
| `package.json` | `build:render:web` → `turbo run build --filter=@mango/web...` |
| `packages/database/package.json` | Moved `prisma` to **`dependencies`** (build + migrate deploy) |
| `.npmrc` | `production=false` so Nest CLI / TypeScript install during Render builds |
| `render.yaml` | `npm ci --include=dev && npm run build:render:api|web` |

## Workspaces

Root `package.json` workspaces: `packages/*`, `apps/*` — unchanged, valid.

## Render build commands

```bash
# torio-api
npm ci --include=dev && npm run build:render:api

# torio-web
npm ci --include=dev && npm run build:render:web
```

## Verification

```bash
test -x node_modules/.bin/turbo          # turbo binary present
NODE_ENV=production npm run build:render:api
NODE_ENV=production npm run build        # full monorepo turbo build
```

Both should complete without `turbo: not found`.
