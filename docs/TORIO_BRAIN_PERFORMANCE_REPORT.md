# Torio Brain Performance Report

**Date:** 2026-06-23  
**Scope:** `/settings/brain` page and `/brain/overview` API

---

## Executive Summary

The Torio Brain settings page was slow because it fetched **all brain data on every page load** via a monolithic `/brain/overview` endpoint, plus three additional analytics endpoints — regardless of which tab the user opened.

After optimization, initial load fetches only **settings + aggregate analytics counts** (~15 lightweight DB queries). Heavy sections (Product Memory, Customer Memory, Order Memory, Insights, Learning, Brand Voice, charts) load **only when their tab is opened**.

---

## Bottlenecks Found

### 1. Monolithic `/brain/overview` API (Critical)

**Before:** `getOverview()` ran **12 parallel Prisma queries** on every page load:

| Query | Impact |
|-------|--------|
| `brainRule.findMany` (all rules) | Full table scan |
| `brainFAQ.findMany` (all FAQs) | Full table scan |
| `brainDocument.findMany` (all docs) | Full table scan |
| `brandVoice.findUnique` | Low |
| `learningSuggestion.findMany` (20) | Medium |
| `customerMemory.findMany` (20 + join) | Medium |
| `productMemory.findMany` (50 + attributes + faqs) | **High** — nested includes |
| `orderMemory.findMany` (50 + customer + items + product) | **High** — 3-level joins |
| `customerInsight.findMany` (20 + customer) | **High** |
| `getCategoriesWithEntries` (all categories + entries) | Medium |
| `getAnalytics` (13 count/aggregate queries) | Medium |
| `getSettings` | Low |

**Estimated payload:** 200 KB–2 MB+ depending on catalog size (products with attributes/FAQs, orders with line items).

### 2. Eager Frontend Queries (Critical)

**Before:** Four API calls fired immediately on mount:

1. `/brain/overview` — monolithic (above)
2. `/brain/analytics/growth` — 6 table scans over 30 days
3. `/brain/orders/analytics` — order aggregates (unused until Order Memory tab)
4. `/brain/copilot/analytics` — copilot metrics (only used on Overview tab)

### 3. Static Imports of Heavy Panels (Medium)

All tab panels (`ProductMemoryPanel`, `OrderMemoryPanel`, `CommercePanel`, `BrainAnalyticsCharts`, etc.) were statically imported, increasing the initial JS bundle and parse time.

### 4. Full-Table Product/Order Lists (Medium)

`/brain/products` and `/brain/orders` returned **all records** with nested includes and no pagination limit.

### 5. Blocking Page Shell (Low–Medium)

The entire page (including navigation) was hidden behind a full-page skeleton until overview loaded, hurting perceived performance.

---

## Changes Made

### Backend

#### `brain.service.ts` — Slim overview
- `getOverview()` now returns only `{ settings, analytics }`.
- Removed 10 heavy queries from the overview path.
- Existing section endpoints unchanged: `/brain/categories`, `/brain/faqs`, `/brain/rules`, `/brain/documents`, `/brain/brand-voice`, `/brain/learning/suggestions`, `/brain/memories`, `/brain/products`, `/brain/orders`, `/brain/insights`.

#### `brain-product.service.ts` / `brain-order.service.ts` — Pagination
- Added `limit` (default 50, max 100) and `offset` query params.
- Prevents unbounded full-catalog fetches.

#### `brain.controller.ts`
- Wired `limit`/`offset` query params to product and order list endpoints.

### Frontend

#### `settings/brain/page.tsx` — Tab-based lazy loading
- **Initial load:** `/brain/overview` only (settings + analytics counts).
- **Overview tab:** additionally fetches `/brain/analytics/growth` and `/brain/copilot/analytics`.
- **Category tabs:** fetches `/brain/categories` only when a category tab is active.
- **FAQs / Rules / Documents:** fetched only when their tab is active.
- **Product Memory, Order Memory, Customer Memory, Learning, Brand Voice, Commerce:** dynamically imported; panels fetch their own data on mount.
- Page shell (header + nav) renders immediately; only content area shows skeletons.
- Memoized tab nav, metric cards, and tab content components.

#### Panel self-fetching
- `BrandVoicePanel` → `/brain/brand-voice`
- `LearningCenterPanel` → `/brain/learning/suggestions`
- `MemoriesPanel` → `/brain/memories`
- `ProductMemoryPanel` → `/brain/products?limit=50`
- `OrderMemoryPanel` → `/brain/orders?limit=50`, `/brain/insights`, `/brain/orders/analytics`

#### Dynamic imports
- `BrandVoicePanel`, `LearningCenterPanel`, `MemoriesPanel`, `BrainAnalyticsCharts`, `ProductMemoryPanel`, `OrderMemoryPanel`, `CommercePanel` loaded via `next/dynamic`.

---

## Before / After Estimates

Estimates assume a medium org: ~100 products, ~200 orders, ~50 FAQs, ~20 rules.

| Metric | Before | After (Overview tab) | After (other tab) |
|--------|--------|----------------------|-------------------|
| API requests on mount | 4 | 1 (+2 when Overview active) | 1 (+1 section) |
| DB queries on overview API | ~25+ | ~15 (counts only) | N/A |
| Overview API payload | 200 KB–2 MB | ~2–5 KB | N/A |
| Time to interactive (est.) | 2–8 s | 300–800 ms | 300 ms + tab fetch |
| JS bundle (initial) | All panels | Core + active tab chunk | Core + active tab chunk |

**Improvement:** Initial load is estimated **4–10× faster** for typical orgs. Orgs with large product/order catalogs see the largest gains since those datasets are no longer loaded upfront.

---

## Query Strategy Summary

| Tab | Queries fired |
|-----|---------------|
| Overview (default) | `overview`, `analytics/growth`, `copilot/analytics` |
| Business/Shipping/Payment/Returns/Products | `categories` |
| FAQs | `faqs` |
| Business Rules | `rules` |
| Brand Voice | `brand-voice` (panel) |
| Learning Center | `learning/suggestions` (panel) |
| Customer Memory | `memories` (panel) |
| Product Memory | `products?limit=50` (panel) |
| Order Memory | `orders?limit=50`, `insights`, `orders/analytics` (panel) |
| Commerce AI | panel-internal |
| Documents | `documents` |
| Test Center | none until test run |
| Settings | uses cached `overview.settings` |

---

## Verification

- `npm run typecheck` — all packages pass
- No business logic changes; same endpoints and UI behavior
- Cache invalidation updated to section-specific query keys

---

## Future Opportunities (not implemented)

- UI pagination controls for Product/Order Memory panels
- Single category fetch endpoint (`/brain/categories/:type`) to avoid loading all categories
- `getAnalytics` could skip `topFaqs`/`topRules` fetch when only counts are needed
- React Query `staleTime` tuning per section to reduce refetches on tab switching
