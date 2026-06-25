# Render Build Compatibility Fix

**Issue:** `sh: 1: turbo: not found` during Render builds.

## Root cause

Render sets `NODE_ENV=production`. With `npm ci`, npm **omits `devDependencies`**. Turbo (and other build tools like `@nestjs/cli`, `typescript`, `prisma`) were only in `devDependencies`, so they were not installed during the build phase.

If the Render dashboard build command uses `npm run build`, it invokes `turbo run build` from the root `package.json`, which requires the `turbo` binary.

## Fixes applied

| Change | File |
|--------|------|
| Moved `turbo` to `dependencies` | `package.json` |
| Added `build:render:api` / `build:render:web` (no turbo required) | `package.json` |
| Build uses `npm ci --include=dev` + render build scripts | `render.yaml` |
| Moved `prisma` to `dependencies` (needed for `db:generate` at build + `db:deploy` at startup) | `packages/database/package.json` |

## Render build commands (render.yaml)

**torio-api:**
```bash
npm ci --include=dev && npm run build:render:api
```

**torio-web:**
```bash
npm ci --include=dev && npm run build:render:web
```

## Dashboard override

If Render services use a custom build command instead of `render.yaml`, set:

- **API:** `npm ci --include=dev && npm run build:render:api`
- **Web:** `npm ci --include=dev && npm run build:render:web`

Do **not** use bare `npm run build` unless turbo is in `dependencies` (now fixed).

## Verification

```bash
NODE_ENV=production npx turbo --version   # should print version
npm run build:render:api                  # should complete without turbo
npm run build:render:web                  # should complete
```
