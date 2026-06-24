# Torio AI eCommerce Messaging Platform

Production-ready multi-tenant SaaS AI omnichannel messaging platform for eCommerce merchants.

## Stack

- **Frontend**: Next.js 15, Tailwind, shadcn/ui patterns, TanStack Query, Zustand
- **Backend**: NestJS, Prisma, PostgreSQL + pgvector, Redis, BullMQ, Socket.io
- **AI**: OpenAI + Claude with multilingual support
- **Channels**: Messenger, Instagram, WhatsApp Business Cloud API

## Quick Start

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:generate && npm run db:migrate && npm run db:seed
npm run dev:api   # http://localhost:4000
npm run dev:web   # http://localhost:3010
npm run dev:admin # http://localhost:3001
```

Or start everything locally (embedded Postgres + API + web):

```bash
npm run dev:local
```

## Default Credentials

**Demo user** (Torio web app — use after `npm run db:seed`):
- Email: `demo@torio.app`
- Password: `demo123456` (or `DEMO_USER_PASSWORD` in `.env`)

Platform admin (super admin panel at http://localhost:3001, after seed):
- Email: `admin@mango.app`
- Password: value of `PLATFORM_ADMIN_PASSWORD` in `.env`

## Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [Deployment](./docs/deployment/DEPLOYMENT.md)
- [Phase 2 — Inbox](./docs/PHASE2-INBOX.md)
- [Phase 3 — CRM](./docs/PHASE3-CRM.md)

## Project Status

| Phase | Status |
|-------|--------|
| Phase 0 — Foundation | Complete |
| Phase 1 — Onboarding | Complete |
| Phase 2 — Omnichannel Inbox | Next |
| Phase 3 — AI Support | Planned |

Built as a **standalone SaaS platform** — not a Shopify app. For production pgvector, use `docker compose up` with the `pgvector/pgvector` image.
