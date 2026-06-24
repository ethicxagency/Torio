# Responsive UI Audit Report

**Date:** June 24, 2026  
**Scope:** `apps/web` — alignment, spacing, overflow, and responsiveness only (no business logic changes)  
**Breakpoints reviewed:** 320, 375, 768, 1024, 1440

---

## 1. Responsive Issues Found

| Area | Issue | Severity |
|------|-------|----------|
| **Sidebar collapsed** | Width was 68px instead of required 64px; icons not consistently centered | Critical |
| **Sidebar toggle** | Conflicting Tailwind width classes fought inline `width` style, causing layout shift | Critical |
| **Top nav (desktop)** | Used inline `marginLeft` spacer instead of shared `--sidebar-width` CSS variable | High |
| **Top nav (320px)** | Brand name, org selector, and action buttons could overflow at 320px | High |
| **Dashboard shell** | `--sidebar-width` not shared with top-nav; inbox full-bleed lacked overflow guards | Medium |
| **Global overflow** | Horizontal scroll possible on narrow viewports without shell/body guards | Medium |
| **Dashboard metrics** | 2-column grid at 320px cramped metric cards | Medium |
| **Inbox (mobile)** | Column widths too wide for 1024px 3-column; details panel only at `xl` (1280px) | Critical |
| **Inbox composer** | Textarea could expand past viewport without `min-w-0` | Medium |
| **Torio Brain tabs** | Horizontal tab strip lacked edge padding on mobile | Medium |
| **Torio Brain documents** | Website import row and stored-doc rows overflowed at 320px | Medium |
| **Torio Brain panels** | Product/order/custom memory master-detail grids used fixed min widths | Medium |
| **Customers table** | Desktop table lacked mobile scroll wrapper with edge padding | Low |
| **Settings grids** | Card grids missing explicit single-column base on smallest screens | Low |

---

## 2. Sidebar Issues Fixed

| Requirement | Fix |
|-------------|-----|
| Collapsed width **64px** | `SIDEBAR_WIDTH_COLLAPSED = 64` in `nav-items.ts` |
| Icons centered (H + V) | Collapsed links use fixed `h-10 w-10 justify-center mx-auto`; logo icon-only and centered in header |
| Equal spacing | Uniform `space-y-1` between nav items; `px-2` padding in collapsed mode |
| No text when collapsed | Labels, tagline, footer, and "Collapse" text hidden; `overflow-hidden` on aside |
| No layout shift on toggle | Width driven by inline style + constants; removed conflicting `w-[68px]` class |
| Hover / active states | Preserved `bg-sidebar-accent` active and hover styles in collapsed mode |
| Tooltips when collapsed | Nav items wrapped in `Tooltip` with `w-full justify-center` wrapper |
| Expanded width **256px** | `SIDEBAR_WIDTH_EXPANDED = 256` (`w-64`) unchanged |
| Transitions **200–300ms** | `SIDEBAR_TRANSITION_MS = 250` on sidebar width, main padding, and top-nav padding |
| CSS variables | `--sidebar-width` and `--layout-transition` on shell root; consumed by `main` and `top-nav` |
| Hook stability | `toggle` uses functional state update to avoid stale closure flicker |

**Files changed:** `nav-items.ts`, `use-sidebar-state.tsx`, `sidebar.tsx`, `dashboard-shell.tsx`, `top-nav.tsx`, `tooltip.tsx`

---

## 3. Mobile Fixes (320 / 375 / 768)

| Page / Component | Fix |
|------------------|-----|
| **320px top nav** | Brand name hidden below 375px; org select capped at 88px; fixed `h-10` icon buttons; `px-2` base padding |
| **375px top nav** | Brand name and org badge visible with truncation |
| **Mobile nav drawer** | Unchanged — hamburger opens left sheet (not modified) |
| **Inbox 320–375px** | Single view: list OR chat; back button; copilot/customer in bottom sheets below `lg` |
| **Inbox filters** | `p-3 sm:p-4`; horizontal filter chips scroll with `overflow-x-auto` |
| **Inbox composer** | Quick replies scroll horizontally; textarea `min-w-0 flex-1` |
| **768px inbox** | 2-column: conversation list (`md:w-64`) + chat; sheets for details below `lg` |
| **Dashboard** | Metrics `grid-cols-1` below 360px; root `min-w-0 overflow-x-hidden` |
| **Customers** | Stats `grid-cols-1` below 375px; mobile card list retained |
| **Torio Brain** | Tab nav scrolls with `-mx-4 px-4` edge padding; forms stack/wrap on narrow screens |
| **Settings** | Card grid `grid-cols-1 md:grid-cols-2`; channels/shipping roots have `overflow-x-hidden` |
| **Global** | `body { overflow-x-hidden }` in `globals.css`; shell root `overflow-x-hidden` |

---

## 4. Desktop Fixes (1024 / 1440)

| Area | Fix |
|------|-----|
| **Sidebar expanded (1024+)** | 256px with logo + labels; footer and collapse button visible |
| **Sidebar collapsed (1024+)** | 64px icon rail with tooltips; main and header padding sync via CSS variable |
| **Top nav alignment** | `lg:pl-[var(--sidebar-width)]` matches main content offset |
| **Inbox 3-column (1024+)** | List (`lg:w-72`) + chat (`flex-1 min-w-0`) + details sidebar (`lg:flex lg:w-64 xl:w-72`) |
| **Inbox 1440px** | List widens to `xl:w-80`; details panel `xl:w-72` |
| **Tables (Customers)** | Desktop table in `-mx-4 px-4 overflow-x-auto` wrapper with `min-w-[640px]` |
| **Brain master-detail** | Product/order/custom memory use `lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]` |
| **Dashboard 1440px** | 4-column metrics at `lg+`; channel cards at `sm:grid-cols-3` |

---

## 5. Remaining Issues

| Issue | Notes |
|-------|-------|
| **Top nav search** | No global search field in top-nav — not present in codebase |
| **Brain tab count** | 19 tabs require horizontal scroll on mobile — scroll container added; vertical sidebar at `lg+` |
| **Product attribute grid** | `sm:grid-cols-[140px_1fr_auto]` may still feel tight at 320px — low-traffic admin surface |
| **Very long org names** | Truncated in top-nav select/badge — acceptable |
| **Manual device QA** | Code-level audit complete; recommend spot-check on real devices for touch targets |

---

## Verification

- `npm run typecheck` — **passed** (all 6 packages)
- No commits made (per instructions)
- No business logic modified

---

## Files Modified

```
apps/web/src/config/nav-items.ts
apps/web/src/hooks/use-sidebar-state.tsx
apps/web/src/components/layout/sidebar.tsx
apps/web/src/components/layout/dashboard-shell.tsx
apps/web/src/components/layout/top-nav.tsx
apps/web/src/components/layout/page-header.tsx
apps/web/src/components/ui/tooltip.tsx
apps/web/src/app/(dashboard)/dashboard/page.tsx
apps/web/src/app/(dashboard)/inbox/page.tsx
apps/web/src/app/(dashboard)/customers/page.tsx
apps/web/src/app/(dashboard)/settings/page.tsx
apps/web/src/app/(dashboard)/settings/brain/page.tsx
apps/web/src/app/(dashboard)/settings/shipping-delivery/page.tsx
apps/web/src/components/inbox/conversation-sidebar.tsx
apps/web/src/components/inbox/conversation-filters.tsx
apps/web/src/components/inbox/message-composer.tsx
apps/web/src/components/brain/brain-engine-panels.tsx
apps/web/src/components/brain/brain-analytics-charts.tsx
apps/web/src/components/brain/custom-memory-panel.tsx
apps/web/src/components/brain/product-memory-panel.tsx
apps/web/src/components/brain/order-memory-panel.tsx
docs/RESPONSIVE_UI_AUDIT_REPORT.md
```
