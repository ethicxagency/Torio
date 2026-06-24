# Torio AI Messaging Platform — Architecture

Multi-tenant SaaS AI omnichannel messaging platform for eCommerce merchants.

## Monorepo Structure

```
./
├── apps/
│   ├── api/          # NestJS REST + WebSocket API (Railway)
│   ├── web/          # Next.js 15 merchant app (Vercel)
│   └── admin/        # Next.js super admin panel (Vercel)
├── packages/
│   ├── database/     # Prisma schema + client (PostgreSQL + pgvector)
│   └── shared/       # Shared types, RBAC constants, API prefixes
├── docker-compose.yml
└── .env.example
```

## Multi-Tenancy

- **Tenant root**: `Organization` — every business is an isolated tenant
- **Tenant scoping**: All tenant data includes `organizationId`; queries always filter by tenant
- **Request context**: `X-Organization-Id` header + JWT user identity
- **Middleware**: `TenantGuard` validates membership, loads RBAC permissions, rejects cross-tenant access
- **Soft deletes**: `deletedAt` on core entities for audit trail

## Authentication

| Flow | Implementation |
|------|----------------|
| Email signup/login | bcrypt + JWT access (15m) + refresh (7d) |
| Google OAuth | Passport Google strategy (configured via env) |
| Email verification | SHA-256 hashed tokens, 24h expiry |
| Password reset | One-time tokens, revokes all refresh tokens |
| Platform admin | Separate `PlatformAdmin` model + admin JWT flag |

## RBAC

Roles: **Owner** > **Admin** > **Agent**

Permissions stored in `permissions` + `role_permissions` tables. Seeded on deploy. Enforced via `@RequirePermissions()` decorator + `TenantGuard`.

## Database Modules (Prisma)

| Module | Models |
|--------|--------|
| Organizations | Organization |
| Users & Auth | User, RefreshToken, OAuthAccount, EmailVerificationToken, PasswordResetToken |
| Memberships | Membership, TeamInvitation |
| RBAC | Permission, RolePermission |
| Subscriptions | Plan, Subscription, Coupon, UsageRecord, FeatureFlag |
| Channels | Channel |
| Messaging | Customer, Conversation, Message |
| Tags & Notes | Tag, ConversationTag, CustomerTag, Note |
| Knowledge | KnowledgeBase, KnowledgeDocument, KnowledgeChunk (pgvector) |
| AI | AiSettings, AiLog |
| Notifications | Notification |
| Audit | AuditLog |
| Platform Admin | PlatformAdmin |

## API Structure (`/api/v1`)

```
/auth/*              Authentication
/organizations/*     Tenant org settings
/team/*              Memberships & invites
/rbac/*              Permission queries
/plans/*             Public plan listing
/subscriptions/*     Billing
/usage/*             Usage metering
/feature-flags/*     Feature toggles
/notifications/*     In-app notifications
/audit-logs/*        Tenant audit trail
/onboarding/*        5-step wizard
/analytics/*         Dashboard metrics
/platform-admin/*    Super admin (separate auth)
/health              Health check
```

## Phase Roadmap

### Phase 0 — Foundation ✅
Auth, org setup, RBAC, subscriptions, usage, feature flags, notifications, audit logs, dashboard shell, super admin foundation

### Phase 1 — Onboarding ✅
5-step wizard (business, channels, knowledge, team, complete)

### Phase 2 — Omnichannel Inbox (Next)
- Meta webhook handlers (Messenger, Instagram)
- WhatsApp Cloud API integration
- Socket.io realtime gateway
- Unified inbox CRUD APIs

### Phase 3 — AI Support (Next)
- OpenAI + Claude providers
- Bangla/English NLU
- pgvector RAG retrieval
- Confidence scoring + human escalation

## Local Development

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev:api    # :4000
npm run dev:web    # :3010
npm run dev:admin  # :3001
```

## Deployment

| Service | Platform | Config |
|---------|----------|--------|
| API | Railway | `apps/api/railway.json` |
| Web | Vercel | `apps/web/vercel.json` |
| Admin | Vercel | Separate project |
| PostgreSQL | Railway / Supabase | pgvector extension required |
| Redis | Railway / Upstash | BullMQ + caching |

## Security

- Helmet, CORS, rate limiting (120/min)
- JWT secrets via environment
- Tenant isolation on every query
- Refresh token rotation
- Audit logging for sensitive actions
- Platform admin impersonation audit trail (Phase 2)
