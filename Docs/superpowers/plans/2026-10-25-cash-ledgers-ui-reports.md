# Cash, Ledgers, UI, and Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect cash control, capital/profit withdrawals, stock pricing, supplier and medicine workspaces, dashboard cards, and new reports into one verified bilingual workflow.

**Architecture:** A shared transactional cash-ledger module is the source of truth for cash-out validation and account summaries. Persistent withdrawal allocations preserve the distinction between profit and capital. Existing server actions remain the mutation boundary, while reusable native-dialog components move edit/payment/archive/adjustment forms into focused modals.

**Tech Stack:** Next.js 16.4.3 App Router, React 19 server actions, TypeScript, Drizzle ORM, PostgreSQL 18, Decimal.js, next-intl, Vitest, Playwright.

**Spec:** `Docs/superpowers/specs/2026-10-25-cash-ledgers-ui-reports-design.md`

## Global Constraints

- Preserve existing production data and audit history; never delete financial rows.
- Monetary arithmetic uses Decimal.js in application code and `numeric(14,2)` in PostgreSQL.
- Cash-out decisions are serialized and checked inside the same database transaction as the write.
- Arabic and French stay feature-equivalent, responsive, keyboard-accessible, and printable where applicable.
- Work in the current checkout because the supplier/accounts implementation being refined is uncommitted; do not create commits unless the user asks.

## Review Focus

- Two simultaneous cash-out requests must not both spend the same remaining cash; Task 2 adds a concurrency integration test.
- Correcting an expense upward must check only the delta while cancellation must restore liquidity; Task 2 tests both.
- Profit can change after a historical withdrawal, so stored profit/capital portions—not later reconstruction—must drive balances; Task 1 tests this.
- A receipt price calculated from projected weighted cost must reject equality and lower values after rounding; Task 3 tests boundary values.
- Legacy capital withdrawals must migrate as capital-funded without changing their previous capital balance; Task 1 verifies the migration constraint.

---

### Task 1: Cash ledger and withdrawal allocation

**Files:** Modify `src/db/schema/finance.ts`, `src/db/schema/index.ts`, `src/lib/errors.ts`, `src/modules/accounts/{schemas,service,queries,actions}.ts`; create `src/modules/accounts/cash.ts`, migration `drizzle/0007_cash_control.sql`, snapshot metadata; test `tests/integration/accounts/accounts.test.ts` and `tests/integration/db/schema.test.ts`.

**Interfaces:** Produces `lockCashLedger(tx)`, `getCashSnapshot(executor)`, and withdrawal input `{source: 'PROFIT' | 'CAPITAL', allowCapitalFallback: boolean}` with stored `profitPortion` and `capitalPortion`.

- [ ] Write failing account/schema tests for cash, profit/capital allocation, explicit mixed confirmation, and legacy-safe constraints.
- [ ] Run the targeted tests and confirm failures describe missing cash/allocation behavior.
- [ ] Implement schema, migration, cash snapshot, and capital movement allocation.
- [ ] Run targeted tests to green.

### Task 2: Enforce cash on expenses and supplier payments

**Files:** Modify `src/modules/expenses/service.ts`, `src/modules/suppliers/service.ts`, related translations/actions; test `tests/integration/expenses/expenses.test.ts`, `tests/integration/suppliers/suppliers.test.ts`, and a cash concurrency case.

**Interfaces:** Consumes `lockCashLedger(tx)` and `getCashSnapshot(tx)` from Task 1.

- [ ] Write failing tests for zero-cash rejection, successful funded payment, expense correction delta, cancellation recovery, and concurrent spending.
- [ ] Confirm RED for `INSUFFICIENT_CASH`.
- [ ] Add transactional guards and specific action errors.
- [ ] Run targeted suites to green.

### Task 3: Cost-aware receipt pricing

**Files:** Modify `src/modules/stock/{schemas,service,actions}.ts`, `src/modules/stock/components/receive-stock-form.tsx`, stock page/query props; test `tests/integration/stock/costing.test.ts` and unit-test projection helpers.

**Interfaces:** Produces `projectReceiptPricing(...)` and accepts `sellingPrice` in `receiveStock`.

- [ ] Write failing tests for projected weighted cost, 20% suggestion, total cost, and non-profitable price rejection.
- [ ] Confirm RED, then implement the pure projection helper and atomic price update with receipt.
- [ ] Build the live receipt summary and editable proposed selling price.
- [ ] Run stock tests to green.

### Task 4: Supplier UI and dashboard cards

**Files:** Create reusable `src/components/action-dialog.tsx`; modify supplier pages/components, dashboard page/view/queries, translations, and supplier/dashboard CSS; update E2E tests.

**Interfaces:** Uses existing supplier actions inside modals and supplier totals for dashboard cards.

- [ ] Add failing E2E assertions for aligned row semantics, modal actions, expanded ledger, and dashboard supplier metrics.
- [ ] Implement the action bar/modals, stable row grid, hero, wider ledger, and dashboard strip.
- [ ] Run the supplier/dashboard E2E subset to green at desktop and mobile widths.

### Task 5: Medicine detail owns all actions

**Files:** Modify medicine list/detail/form components, stock adjustment component, translations, and CSS; update E2E.

**Interfaces:** Catalogue links to detail only; detail modals call existing medicine and stock actions.

- [ ] Add failing E2E assertions that catalogue rows have no inline controls and detail modals support edit, archive/restore, and signed adjustment.
- [ ] Move controls to the detail action bar and implement explicit plus/minus adjustment UI.
- [ ] Run medicine E2E at desktop/mobile widths to green.

### Task 6: Accounts and supplier reports

**Files:** Modify report catalog/builders/filter options/translations; add report builder integration assertions and report E2E coverage.

**Interfaces:** `cash-flow` consumes the cash-ledger event projection; `supplier-balances` consumes current supplier aggregates.

- [ ] Add failing builder/catalog tests for the two new report slugs and their literal totals/rows.
- [ ] Implement report groups and builders through the existing report document pipeline.
- [ ] Run report integration and E2E subsets to green.

### Task 7: Accounts UI, integration polish, and release verification

**Files:** Modify Accounts workspace, account/supplier/stock translations, global responsive CSS, and the combined E2E workflow; update relevant Docs.

**Interfaces:** Consumes Tasks 1–6 and exposes profit-first withdrawal confirmation in the UI.

- [ ] Add failing E2E coverage for separate cash/capital/profit cards and profit-first mixed withdrawal confirmation.
- [ ] Implement the account modal and responsive visual polish; update the complete workflow test.
- [ ] Run lint, typecheck, unit, integration, production build, full E2E, fresh migration, and `git diff --check`.
- [ ] Rebuild the Docker app on localhost and smoke-test the admin flow.

