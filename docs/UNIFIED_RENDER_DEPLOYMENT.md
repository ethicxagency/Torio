# Unified Render Deployment (Web + API)

Serve the Torio Next.js app and NestJS API from **one Render domain**.

| Path | Handler |
|------|---------|
| `/` | Next.js (Torio Web) |
| `/login`, `/dashboard`, `/inbox`, … | Next.js |
| `/api/v1/*` | NestJS API |
| `/socket.io/*` | NestJS (Socket.IO / inbox) |

---

## Architecture

```
Browser → Render PORT (public)
            ↓
     render-start-unified.mjs (reverse proxy)
       ├── /api/* , /socket.io/* → NestJS :4001
       └── everything else        → Next.js :3001
```

---

## Render configuration

**Build command:**
```bash
npm ci --include=dev && npm run build:render:unified
```

**Start command:**
```bash
node scripts/render-start-unified.mjs
```

**Health check:** `/api/v1/health`

### Required environment variables

Set all to your **same public URL** (e.g. `https://torio-yb2m.onrender.com`):

| Variable | Example |
|----------|---------|
| `API_URL` | `https://torio-yb2m.onrender.com` |
| `WEB_URL` | `https://torio-yb2m.onrender.com` |
| `CORS_ORIGINS` | `https://torio-yb2m.onrender.com` |
| `NEXT_PUBLIC_API_URL` | Optional — defaults to `{origin}/api/v1` in browser |

Meta (unchanged paths):

| Variable | Value |
|----------|-------|
| `META_OAUTH_REDIRECT_URL` | `https://torio-yb2m.onrender.com/api/v1/channels/meta/callback` |
| `META_WEBHOOK_URL` | `https://torio-yb2m.onrender.com/api/v1/webhooks` |

---

## Updating an existing API-only service

If `torio-yb2m.onrender.com` currently runs **API only**:

1. Render Dashboard → your web service → **Settings**
2. Update **Build Command** and **Start Command** (above)
3. Set `API_URL`, `WEB_URL`, `CORS_ORIGINS` to the service URL
4. Remove separate `torio-web` service if duplicated (optional cost saving)
5. **Manual Deploy** → Deploy latest commit

Or apply the updated `render.yaml` Blueprint.

---

## Local development

Unchanged — run API and web separately:

```bash
npm run dev:local
```

---

## Routing

| URL | Behavior |
|-----|----------|
| `/` | Redirect → `/login` or `/dashboard` (auth state) |
| `/login` | → `/auth/login` |
| `/register` | → `/auth/signup` |
| `/api/v1/health` | API health check |
| `/api/v1/webhooks/meta` | Meta webhook verification |
