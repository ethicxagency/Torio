const DEV_WEB_URL = "http://localhost:3010";
const DEV_API_URL = "http://localhost:4000";

export function getApiPort(): number {
  // Unified deploy: NestJS binds to INTERNAL_API_PORT; Render PORT is the public proxy.
  const raw =
    process.env.INTERNAL_API_PORT?.trim() ||
    process.env.PORT?.trim() ||
    process.env.API_PORT?.trim() ||
    "4000";
  const port = Number(raw);
  return Number.isFinite(port) && port > 0 ? port : 4000;
}

export function getWebUrl(fallback = DEV_WEB_URL): string {
  return process.env.WEB_URL?.trim() || fallback;
}

export function getApiUrl(fallback = DEV_API_URL): string {
  return process.env.API_URL?.trim() || fallback;
}

export function getCorsOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? DEV_WEB_URL)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/** Meta webhook callback base — override with META_WEBHOOK_URL if using a proxy/CDN. */
export function getMetaWebhookBaseUrl(): string {
  const override = process.env.META_WEBHOOK_URL?.trim();
  if (override) return override.replace(/\/$/, "");
  return `${getApiUrl().replace(/\/$/, "")}/api/v1/webhooks`;
}

export function getMetaWebhookUrl(channel: "meta" | "whatsapp" = "meta"): string {
  return `${getMetaWebhookBaseUrl()}/${channel}`;
}

export function getMetaOAuthRedirectUrl(): string {
  const configured = process.env.META_OAUTH_REDIRECT_URL?.trim();
  if (configured) return configured;
  return `${getApiUrl().replace(/\/$/, "")}/api/v1/channels/meta/callback`;
}

export function assertProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") return;

  const required = [
    "DATABASE_URL",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "WEB_URL",
    "API_URL",
    "CORS_ORIGINS",
  ];

  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }

  if (!process.env.META_WEBHOOK_VERIFY_TOKEN?.trim()) {
    console.warn(
      "[torio-api] META_WEBHOOK_VERIFY_TOKEN is not set — Meta webhook verification will fail in production.",
    );
  }
}
