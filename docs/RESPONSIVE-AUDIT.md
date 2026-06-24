# Responsive Design & Mobile Optimization Audit

**Date:** June 2026  
**Scope:** `apps/web` — UI only, no backend or business logic changes  
**Target:** Bangladesh eCommerce merchants (70% mobile, 30% desktop)

---

## Executive Summary

A full responsive audit was performed across authentication, onboarding, dashboard, inbox, customers, team, knowledge, analytics, and settings. Mobile-first layouts were implemented where desktop patterns broke on small screens. The inbox received the highest priority treatment.

---

## Breakpoint Strategy

| Breakpoint | Usage |
|------------|-------|
| `<640px` (default) | Mobile-first base styles |
| `sm:` 640px+ | Larger touch targets, inline labels |
| `md:` 768px+ | Two-column layouts, table views |
| `lg:` 1024px+ | Fixed desktop sidebar |
| `xl:` 1280px+ | Three-column inbox (list + chat + customer panel) |

---

## Page-by-Page Audit

### Authentication

| Page | Problems Found | Fix Applied |
|------|----------------|-------------|
| **Login** | Forgot password link too small (text-xs) | 44px touch target, text-sm link |
| **Signup** | Already responsive | Verified max-w-md, full-width inputs |
| **Forgot Password** | Page missing (404 from login link) | Added responsive page using existing API |
| **Reset Password** | Page missing | Added responsive page with token validation |

**Before:** Broken forgot-password link, small tap targets  
**After:** Full auth flow works on 320px–1440px with 16px inputs (no iOS zoom)

---

### Onboarding

| Problems Found | Fix Applied |
|----------------|-------------|
| Step labels hidden on mobile | Horizontal scroll step pills with abbreviated labels |
| Truncated labels at sm | First-word labels on mobile, full labels on sm+ |

---

### Dashboard Layout

| Problems Found | Fix Applied |
|----------------|-------------|
| Inbox height ignored bottom safe area | `100dvh` + `safe-area-inset` CSS |
| Bottom nav conflict (removed) | Drawer navigation via hamburger |
| No iOS safe-area support | `env(safe-area-inset-*)` utilities |

---

### Navigation

| Viewport | Before | After |
|----------|--------|-------|
| **Desktop (lg+)** | Fixed 256px sidebar | Unchanged, 44px nav item height |
| **Tablet/Mobile (<lg)** | Bottom tab bar (5 items, missing Knowledge) | Hamburger → left drawer with all 6 routes |
| **Top nav mobile** | Empty header, no brand | Torio logo + menu button |

---

### Inbox (Highest Priority)

| Viewport | Before | After |
|----------|--------|-------|
| **Desktop (xl+)** | 3 columns | List + chat + customer panel (280–320px) |
| **Tablet (md–xl)** | 2 columns, no customer panel | List + chat; customer via sheet button |
| **Mobile** | List ↔ chat toggle only | Same + bottom sheet for customer profile |

| Problem | Fix |
|---------|-----|
| Customer panel `hidden lg:flex` — no mobile access | Bottom sheet with full CustomerPanelContent |
| Close conversation hidden `<sm` | Visible Close button on all mobile sizes |
| Back button ~32px | 44×44px touch target |
| Composer under safe area | `safe-bottom` padding on composer |
| Filter pills too small | min-h 36px, text-sm |
| Quick replies too small | py-2, text-sm chips |

---

### Customers

| Problem | Fix |
|---------|-----|
| Table-only, horizontal scroll on mobile | Card list view `<md`, table `md+` |
| 5 stat cards uneven on mobile | 2-col → 3-col → 5-col responsive grid |
| Small tag badges | text-xs on mobile cards |

---

### Customer Profile

| Problem | Fix |
|---------|-----|
| Sidebar cards below fold on mobile | Reordered: summary/assignment/tags first |
| Tab bar overflow risk | Horizontal scroll, 44px tab height |
| Notes input + icon cramped | Stacked on mobile, full-width input |

---

### Dashboard / Analytics

| Problem | Fix |
|---------|-----|
| Channel stats `grid-cols-3` on 320px | `grid-cols-1 sm:grid-cols-3` |
| Metric cards 2-col on mobile | Kept 2-col (readable), improved spacing |

---

### Team Settings

| Problem | Fix |
|---------|-----|
| Suspend button icon-only, ~36px | 44px min height, "Suspend" label on sm+ |
| Role select fixed width | Full-width on mobile via flex-wrap |

---

### Tags Settings

| Problem | Fix |
|---------|-----|
| Color swatches 32×32px | Increased to 44×44px |

---

### Knowledge Base

| Status | Notes |
|--------|-------|
| Empty state only | Responsive empty state; now reachable via drawer nav |

---

### Settings / Channels

| Status | Notes |
|--------|-------|
| Already stacks on mobile | Connect cards 1-col below sm; verified |

---

## Global UI Improvements

| Area | Change |
|------|--------|
| **Inputs** | 16px font on mobile (prevents iOS zoom), h-11 on mobile |
| **Buttons** | Default h-11 mobile / h-10 desktop; icon buttons 44×44 |
| **Textareas** | text-base mobile, text-sm desktop |
| **Typography** | body text-sm base, sm:text-base on larger screens |
| **Sheet component** | New Radix-based bottom/left sheets for mobile modals |
| **Dark mode** | All changes use CSS variables; verified compatible |

---

## Accessibility Checklist

- [x] Minimum 44×44px touch targets on primary actions
- [x] 16px form inputs on mobile (no iOS zoom)
- [x] Focus rings on buttons/inputs (existing ring utilities)
- [x] aria-label on icon-only buttons (menu, profile, logout)
- [x] sr-only close button label on sheets
- [x] Keyboard-accessible sheet (Radix Dialog)
- [x] Sufficient contrast via existing light/dark tokens

---

## Performance

| Item | Status |
|------|--------|
| Lazy loading routes | Next.js App Router (automatic) |
| Sheet component | Loaded only when opened |
| No new heavy dependencies | Reused @radix-ui/react-dialog |
| Memoization | No unnecessary re-render changes (out of scope) |

---

## Files Changed

```
apps/web/src/
├── app/
│   ├── globals.css
│   ├── auth/forgot-password/page.tsx (new)
│   ├── auth/reset-password/page.tsx (new)
│   ├── auth/login/page.tsx
│   ├── onboarding/page.tsx
│   └── (dashboard)/
│       ├── layout.tsx
│       ├── dashboard/page.tsx
│       ├── inbox/page.tsx
│       ├── customers/page.tsx
│       └── customers/[id]/page.tsx
│       └── settings/team/page.tsx
│       └── settings/tags/page.tsx
├── components/
│   ├── ui/sheet.tsx (new)
│   ├── ui/button.tsx
│   ├── ui/input.tsx
│   ├── ui/textarea.tsx
│   ├── layout/dashboard-shell.tsx (new)
│   ├── layout/mobile-nav.tsx (new)
│   ├── layout/sidebar.tsx
│   ├── layout/top-nav.tsx
│   ├── layout/page-header.tsx
│   └── inbox/
│       ├── customer-panel.tsx
│       ├── conversation-filters.tsx
│       └── message-composer.tsx
```

---

## Verification Checklist

Test at: **320, 375, 390, 414, 768, 1024, 1280, 1440px**

- [x] Auth pages render without horizontal overflow
- [x] Hamburger opens full navigation drawer
- [x] Inbox: list → chat → back flow on mobile
- [x] Inbox: customer profile opens as bottom sheet
- [x] Customers: card view on mobile, table on desktop
- [x] Dashboard channel stats stack on narrow screens
- [x] Forms use full-width inputs on mobile
- [x] Dark mode compatible across changed components

---

## Page-by-Page Inspection Pass (Playwright)

**Method:** Automated browser inspection at 320/375/768/1280px with authenticated sessions.

| Result | Detail |
|--------|--------|
| Overflow | **0 issues** across all 16 routes |
| Auth bug found | Zustand persist hydration caused redirect to login before pages rendered — **fixed in `auth-guard.tsx`** |
| Layout bug found | Inbox height `calc()` ignored flex context — **fixed with flex column shell** |

### Additional fixes from live inspection

- **Top nav:** Icons now align right on mobile (`flex-1` spacer)
- **Inbox:** `min-h-0` scroll chain; 72px conversation rows; sheet header padding
- **Customers:** Export/bulk bars stack on mobile
- **Customer profile:** Sidebar reordered above tabs on mobile; conversation rows stack
- **Settings/channels:** Connected rows stack; WhatsApp form buttons full-width on mobile
- **Settings/team:** Role select full-width on mobile
- **Onboarding:** Numbered step circles on mobile (readable vs truncated text)
- **Auth:** 44px tap targets on links and submit buttons

Re-run checks:
```bash
node scripts/responsive-inspect.mjs
node scripts/responsive-deep-inspect.mjs
```

---

## Remaining Recommendations (Future, Out of Scope)

- Collapsible sidebar on tablet (1024–1280) with narrow icon-only mode
- Virtualized conversation list for very long inboxes
- `@media (prefers-reduced-motion)` for sheet animations
- PWA install prompt for Bangladesh mobile merchants
