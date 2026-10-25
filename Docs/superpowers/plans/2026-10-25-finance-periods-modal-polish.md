# Finance Periods and Modal Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centre and clarify action dialogs, add period-aware account metrics, and surface financial and stock summary cards on the dashboard and stock pages.

**Architecture:** Reuse the dashboard period parser and URL filter UI. Split current cash state from range-based financial performance in the accounts query layer, then pass server-derived summaries to existing client views. Keep stock aggregation as a pure tested helper.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle/PostgreSQL, next-intl, Vitest, Playwright, CSS.

**Spec:** `Docs/superpowers/specs/2026-10-25-finance-periods-modal-polish-design.md`

## Global Constraints

- Keep current teal/white pharmacy identity and local Noto fonts.
- Current balances must not be presented as period-only figures.
- Arabic and French must receive matching labels and responsive layouts.
- Do not commit without explicit user approval.

## Review Focus

- Custom date endpoints are inclusive for the selected final day.
- A period with no sales or expenses produces zero performance without changing current balances.
- Dialog centring survives RTL, wide desktop viewports, and mobile viewports.
- Withdrawal source labels and errors remain readable inside the dark accounts hero subtree.
- Archived medicines do not inflate stock summary cards.

---

### Task 1: Period-aware accounts data

**Files:**
- Create: `src/modules/accounts/period.ts`
- Modify: `src/modules/accounts/cash.ts`, `src/modules/accounts/queries.ts`, `src/app/[locale]/(app)/accounts/page.tsx`
- Test: `tests/unit/accounts/period.test.ts`, `tests/integration/accounts/accounts.test.ts`

- [x] Write failing tests for monthly default, custom range, and range-scoped performance/history.
- [x] Run tests and confirm failures are caused by missing period support.
- [x] Implement the parser and split current snapshot from range performance.
- [x] Run the focused tests to green.

### Task 2: Dialog centring and form contrast

**Files:**
- Modify: `src/app/globals.css`, `src/modules/accounts/components/accounts-workspace.tsx`
- Test: `tests/e2e/suppliers-accounts-medicine.spec.ts`

- [x] Add browser assertions for centred dialog geometry, visible source cards, and high-contrast errors.
- [x] Implement explicit fixed centring and isolated dialog colour styles.
- [x] Run desktop and mobile browser tests to green.

### Task 3: Dashboard and stock summaries

**Files:**
- Create: `src/modules/stock/summary.ts`
- Modify: `src/app/[locale]/(app)/dashboard/page.tsx`, `src/modules/dashboard/components/dashboard-view.tsx`, `src/app/[locale]/(app)/stock/page.tsx`, translations and CSS.
- Test: `tests/unit/stock/summary.test.ts`, relevant E2E journeys.

- [x] Write the failing stock aggregation test with hand-calculated values.
- [x] Implement the stock summary helper and render both summary sections.
- [x] Add bilingual labels and responsive styles.
- [x] Run unit, integration, browser, lint, typecheck, and production build verification.
