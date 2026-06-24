# Prisma Import Audit Report

**Date:** June 24, 2026  
**Scope:** `apps/api` — `@prisma/client` imports vs `packages/database/prisma/schema.prisma`

---

## Executive Summary

All nine enums flagged in deployment errors **exist in `schema.prisma`**, **match import names exactly**, and **export correctly after `npm run db:generate`**. Backend TypeScript (`npm run typecheck --workspace=@mango/api`) passes locally.

The root issue was **migration drift**: schema grew (courier, policies, custom memory) but only the init migration existed. Render runs `prisma migrate deploy` on startup; without a follow-up migration, the database lacked new tables/enums even though the generated client included them.

**Fix applied:** Added migration `20250624000000_add_courier_policies_custom_memory`.

---

## 1. Missing Prisma Models

**None** — all models referenced in backend code exist in `schema.prisma`.

Models used by courier/tracking/policy modules (all present in schema):

| Model | In schema | In init migration | In new migration |
|-------|-----------|-------------------|------------------|
| `CourierConnection` | Yes | No | Yes |
| `ShippingDeliverySettings` | Yes | No | Yes |
| `DeliveryIntelligence` | Yes | No | Yes |
| `Shipment` | Yes | No | Yes |
| `ShipmentEvent` | Yes | No | Yes |
| `TrackingLog` | Yes | No | Yes |
| `ReturnPolicy`, `RefundPolicy`, etc. | Yes | No | Yes |
| `CustomMemoryField`, `MemoryGroup`, etc. | Yes | No | Yes |

---

## 2. Missing Prisma Enums

### Requested enums — all present

| Enum | In schema.prisma | Exact name match | In generated client | In init migration | In new migration |
|------|------------------|------------------|---------------------|-------------------|------------------|
| `CourierProviderType` | Yes | Yes | Yes | No | Yes |
| `ShipmentStatus` | Yes | Yes | Yes | No | Yes |
| `TrackingLanguage` | Yes | Yes | Yes | No | Yes |
| `TrackingResponseStyle` | Yes | Yes | Yes | No | Yes |
| `CustomerStatus` | Yes | Yes | Yes | Yes | — |
| `ActivityType` | Yes | Yes | Yes | Yes | — |
| `AssignmentType` | Yes | Yes | Yes | Yes | — |
| `LeadSource` | Yes | Yes | Yes | Yes | — |
| `MembershipRole` | Yes | Yes | Yes | Yes | — |

### Enums added to schema after init (also in new migration)

- `CourierConnectionStatus`
- `CustomMemoryFieldType`, `CustomMemoryScope`, `CustomMemoryFieldStatus`
- `PolicyCategoryType`, `PolicyStatus`
- `TrackingSyncInterval`

---

## 3. Invalid Imports

Scanned **56 unique symbols** imported from `@prisma/client` across `apps/api/src`.

| Symbol | Status |
|--------|--------|
| All enums/types used in services, DTOs, providers | Valid — exist in schema |
| `PrismaClient` | Valid — generated export (not a schema enum) |
| `Prisma` namespace | Valid |

**No invalid enum or model imports found.**

---

## 4. Models / Enums Referenced in Code but Not in Schema

**None found.**

---

## 5. Verification Results

| Check | Result |
|-------|--------|
| `npm run db:generate` | Pass |
| `npm run typecheck --workspace=@mango/api` | Pass |
| All 9 requested enums in `@prisma/client` | Pass |
| Migrations cover full schema | Fixed — new migration added |
| `render.yaml` build includes `db:generate` | Yes (before API build) |
| `render-start-api.mjs` runs `db:deploy` | Yes |

---

## 6. Why Render May Have Reported Missing Enums

1. **Build without `db:generate`** — stale `@prisma/client` would lack enums added after last generate. `render.yaml` already runs `npm run db:generate` in `buildCommand`.
2. **Migration drift** — `migrate deploy` only applied init migration; runtime DB queries against courier/policy tables would fail (separate from TypeScript enum errors).
3. **Cached build** — Render cache may skip generate if not invalidated after schema changes.

---

## 7. Recommended Deployment Steps

```bash
# Local verification
npm run db:generate
npm run db:deploy    # applies init + new migration
npm run typecheck
npm run build --workspace=@mango/api

# Commit migration (when ready)
git add packages/database/prisma/migrations/20250624000000_add_courier_policies_custom_memory/
git add docs/PRISMA_IMPORT_AUDIT_REPORT.md
git commit -m "Add Prisma migration for courier, policies, and custom memory"
git push origin main
```

On Render, redeploy `torio-api` so build runs `db:generate` and startup runs `db:deploy` with the new migration.

---

## 8. Import Locations (Requested Enums)

| Enum | Primary files |
|------|-----------------|
| `CourierProviderType` | `courier/*.ts`, `courier/providers/*.ts` |
| `ShipmentStatus` | `tracking/*.ts`, `courier/providers/*.ts` |
| `TrackingLanguage` | `courier/courier.service.ts`, `tracking/brain-tracking.service.ts` |
| `TrackingResponseStyle` | `brain-ai.service.ts`, `courier/*.ts`, `tracking/*.ts` |
| `CustomerStatus` | `customers/*.ts` |
| `ActivityType` | `activities.service.ts`, `customers.service.ts`, `notes.service.ts` |
| `AssignmentType` | `customers.service.ts`, `assignments.service.ts` |
| `LeadSource` | `customers/*.ts` |
| `MembershipRole` | `auth`, `memberships`, `rbac`, `onboarding`, `assignments` |

All imports use `@prisma/client` directly (consistent with rest of codebase). `@mango/database` re-exports `@prisma/client` for the Prisma client singleton.
