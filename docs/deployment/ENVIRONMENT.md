# Environment Variables

Configuration for Torio lives in **`.env`** at the project root.

Copy the template:

```bash
cp .env.example .env
```

See [.env.example](../../.env.example) for the full list.

## Required for local development

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection |
| `JWT_ACCESS_SECRET` | Access token signing |
| `JWT_REFRESH_SECRET` | Refresh token signing |
| `WEB_URL` | Frontend URL (default `http://localhost:3010`) |
| `API_URL` | Backend URL (default `http://localhost:4000`) |

## Optional integrations

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth login |
| `META_APP_ID` / `META_APP_SECRET` | Messenger + Instagram |
| `WHATSAPP_*` | WhatsApp Cloud API |
| `SMTP_*` | Transactional email |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | AI features |

## Mango Product Feed (separate app)

The Shopify app in `mango-product-feed/` uses different variables. See [mango-product-feed/.env.example](../../../mango-product-feed/.env.example).
