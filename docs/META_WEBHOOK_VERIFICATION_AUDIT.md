# Meta Webhook Verification Endpoint — Audit Report

**Endpoint:** `GET /api/v1/webhooks/meta`  
**Production URL:** `https://torio-yb2m.onrender.com/api/v1/webhooks/meta`  
**Date:** June 2026

---

## Summary

| Requirement | Status | Notes |
|-------------|--------|-------|
| Reads `hub.mode` | **Pass** | `@Query("hub.mode")` |
| Reads `hub.verify_token` | **Pass** | `@Query("hub.verify_token")` |
| Reads `hub.challenge` | **Pass** | `@Query("hub.challenge")` |
| Compares token to `META_WEBHOOK_VERIFY_TOKEN` | **Pass** | Via `ConfigService` |
| Valid → return challenge, HTTP 200 | **Pass** | Returns challenge string |
| Invalid → HTTP 403 | **Fail** | Returns HTTP **200** with body `"Forbidden"` |

---

## Route & access

- **Controller:** `WebhooksController` — `@Controller("webhooks")`
- **Global prefix:** `/api` + URI versioning `v1` → `/api/v1/webhooks/meta`
- **Auth:** `@Public()` — no JWT required (correct for Meta verification)
- **Method:** `GET` only (POST handler unchanged, separate route)

---

## Exact implementation

### Controller (`webhooks.controller.ts`)

```9:18:apps/api/src/modules/webhooks/webhooks.controller.ts
  @Public()
  @Get("meta")
  verifyMeta(
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") token: string,
    @Query("hub.challenge") challenge: string,
  ) {
    const result = this.service.verifyMetaToken(mode, token, challenge);
    return result ?? "Forbidden";
  }
```

**Behavior:**

- Calls `verifyMetaToken(mode, token, challenge)`.
- If service returns a string (challenge) → Nest sends **HTTP 200** with that body.
- If service returns `null` → controller returns `"Forbidden"` → Nest still sends **HTTP 200** (not 403).

### Service (`webhooks.service.ts`)

```35:54:apps/api/src/modules/webhooks/webhooks.service.ts
  verifyMetaToken(mode: string, token: string, challenge: string) {
    const configured = this.config.get<string>("META_WEBHOOK_VERIFY_TOKEN")?.trim();
    const isProduction = this.config.get<string>("NODE_ENV") === "production";

    if (isProduction && !configured) {
      this.logger.error("Meta webhook verification rejected: META_WEBHOOK_VERIFY_TOKEN is required in production");
      return null;
    }

    const verifyToken = configured || "mango_webhook_verify";
    if (mode === "subscribe" && token === verifyToken) {
      return challenge;
    }
    if (mode === "subscribe") {
      this.logger.warn(
        `Meta webhook verification failed: verify token mismatch (configured=${configured ? "yes" : "default"})`,
      );
    }
    return null;
  }
```

**Logic flow:**

1. Load `META_WEBHOOK_VERIFY_TOKEN` from env (trimmed).
2. **Production:** if env var missing/empty → log error, return `null` (verification fails).
3. **Development:** if env var missing → fallback token `"mango_webhook_verify"`.
4. **Success:** `hub.mode === "subscribe"` **and** `hub.verify_token === verifyToken` → return `hub.challenge` unchanged.
5. **Failure:** any other case → return `null` (wrong mode, wrong token, or missing production env).

### Environment variable

| Variable | Source | Used in |
|----------|--------|---------|
| `META_WEBHOOK_VERIFY_TOKEN` | Render env / `.env` | `verifyMetaToken()` |
| `NODE_ENV` | `production` on Render | Blocks verification if token unset |

Configured in `render.yaml` with `generateValue: true` for new Blueprint deploys.

Startup warning if unset: `apps/api/src/common/config/app-env.ts` → `assertProductionEnv()`.

---

## Query parameters (Meta spec)

| Parameter | Nest binding | Purpose |
|-----------|--------------|---------|
| `hub.mode` | `mode` | Must be `"subscribe"` for verification |
| `hub.verify_token` | `token` | Compared to `META_WEBHOOK_VERIFY_TOKEN` |
| `hub.challenge` | `challenge` | Echoed back on success |

Example verification URL Meta calls:

```
GET /api/v1/webhooks/meta?hub.mode=subscribe&hub.verify_token=<YOUR_TOKEN>&hub.challenge=<RANDOM_STRING>
```

---

## Live production tests

**Base URL:** `https://torio-yb2m.onrender.com/api/v1/webhooks/meta`

| Test | Request | HTTP status | Body |
|------|---------|-------------|------|
| Invalid token | `hub.mode=subscribe&hub.verify_token=invalid&hub.challenge=test123` | **200** | `Forbidden` |
| Missing token param | `hub.mode=subscribe&hub.challenge=test123` | **200** | `Forbidden` |
| Wrong mode | `hub.mode=unsubscribe&hub.verify_token=anything&hub.challenge=abc123` | **200** | `Forbidden` |

**Expected on success** (with correct `META_WEBHOOK_VERIFY_TOKEN`):

```
HTTP 200
Body: <exact hub.challenge value>
```

*(Success case not tested here — production verify token value is secret.)*

---

## Compliance gap: HTTP 403

**Requirement:** invalid verification → **HTTP 403**

**Current behavior:** invalid verification → **HTTP 200** + body `"Forbidden"`

Meta’s docs accept plain-text challenge on success; on failure, returning non-200 is best practice and matches your spec. To comply without touching the POST handler, the GET handler would need to throw `ForbiddenException` (or set `@Res()` status 403) when `verifyMetaToken` returns `null`.

---

## POST handler (unchanged — audit only)

```20:24:apps/api/src/modules/webhooks/webhooks.controller.ts
  @Public()
  @Post("meta")
  handleMeta(@Body() body: Record<string, unknown>) {
    return this.service.handleMetaWebhook(body);
  }
```

Not modified per task scope.

---

## WhatsApp verification (same logic)

`GET /api/v1/webhooks/whatsapp` delegates to the same `verifyMetaToken()` via `verifyWhatsAppToken()`.

---

## Checklist for Meta App Dashboard

1. **Callback URL:** `https://torio-yb2m.onrender.com/api/v1/webhooks/meta`
2. **Verify token:** must match Render env `META_WEBHOOK_VERIFY_TOKEN` exactly
3. **Subscribe** to `messages`, `messaging_postbacks`, etc. as needed
4. Confirm verification shows success (Meta receives challenge echoed with HTTP 200)

---

## Recommended fix (optional, GET only)

```typescript
import { ForbiddenException } from "@nestjs/common";

@Get("meta")
verifyMeta(...) {
  const result = this.service.verifyMetaToken(mode, token, challenge);
  if (result === null) throw new ForbiddenException();
  return result;
}
```

This satisfies the HTTP 403 requirement without changing POST behavior.
