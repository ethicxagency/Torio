# Deployment

Deploy the **Torio** monorepo — a standalone SaaS, not a Shopify embedded app.

## Local

```bash
cp .env.example .env
npm install
npm run dev:local
```

Starts embedded Postgres (if needed), API on `:4000`, and web on `:3010`.

## Production checklist

1. PostgreSQL 16+ (pgvector recommended for AI features)
2. Redis (queues, caching)
3. Set all secrets from `.env.example`
4. Run migrations: `npm run db:deploy` (production) or `npm run db:migrate` (development)
5. Seed plans/admin: `npm run db:seed`
6. Build: `npm run build`
7. Start API and web workspaces separately

## Render

See [render.yaml](../render.yaml) for the Render Blueprint and [DEPLOYMENT_READINESS.md](./DEPLOYMENT_READINESS.md) for the full checklist, env vars, and deploy steps.

## Docker

Use `docker-compose.yml` for local Postgres + Redis.

## Historical note

This repository previously included a Shopify embedded app in `mango-product-feed/`. That app is independent — see [../../docs/migration/SHOPIFY-REMOVAL-AUDIT.md](../../docs/migration/SHOPIFY-REMOVAL-AUDIT.md).
