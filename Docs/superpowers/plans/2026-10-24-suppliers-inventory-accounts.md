# Suppliers, Medicine Ledgers, and Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add supplier ledgers, cost-aware medicine ledgers and stock adjustment, plus capital and profit accounts to the existing bilingual pharmacy PWA.

**Architecture:** Extend the PostgreSQL ledgers rather than deriving finance from UI state. Services own transactions, locking, validation, authorization, and audit; server pages query read models; small client forms handle progressive feedback.

**Tech Stack:** Next.js 16.4 App Router, React 19, TypeScript, Drizzle ORM/PostgreSQL, Zod 4, next-intl, Vitest, Playwright.

**Spec:** `Docs/superpowers/specs/2026-10-24-suppliers-inventory-accounts-design.md`

## Global Constraints

- Read relevant bundled Next.js documentation in `node_modules/next/dist/docs/` before code changes.
- Preserve existing uncommitted company-profile and settings work.
- Use MRU numeric values with two decimal places and `Decimal` for application arithmetic.
- Never hard-delete financial history and never allow negative medicine stock.
- Server actions must authenticate and authorize independently.
- Arabic and French copy ship together.

## Review Focus

- Concurrent stock receipts or sales must not lose quantity or average-cost updates.
- Supplier overpayment must produce an advance, not an error or a hidden zero balance.
- Legacy zero-cost sale/receipt rows must remain queryable and must not invent accounting values.
- A failed multi-ledger receipt must roll back medicine, supplier, and movement changes together.
- Archived medicines/suppliers must remain visible in historical ledgers but unavailable for new transactions.

---

### Task 1: Financial and inventory schema

**Files:**
- Modify: `src/db/schema/catalog.ts`
- Modify: `src/db/schema/operations.ts`
- Modify: `src/db/schema/index.ts`
- Create: `src/db/schema/suppliers.ts`
- Create: `src/db/schema/finance.ts`
- Create: `drizzle/0006_suppliers_inventory_accounts.sql`
- Modify: `tests/factories/database.ts`
- Test: `tests/integration/db/schema.test.ts`

**Interfaces:**
- Produces: `suppliers`, `supplierPayments`, `capitalMovements`; receipt supplier/cost fields; medicine average cost; sale-item unit cost; supplier/capital enums.

- [ ] Add schema assertions for new tables, columns, checks, indexes, and foreign keys; run the schema integration test and verify it fails because the schema is absent.
- [ ] Add the Drizzle schema and migration with legacy-safe defaults/nullability; run migrations and the schema test until it passes.
- [ ] Update database reset order and run the complete integration schema suite.

### Task 2: Supplier ledger domain

**Files:**
- Create: `src/modules/suppliers/schemas.ts`
- Create: `src/modules/suppliers/service.ts`
- Create: `src/modules/suppliers/queries.ts`
- Create: `src/modules/suppliers/actions.ts`
- Modify: `src/modules/permissions/catalog.ts`
- Test: `tests/integration/suppliers/suppliers.test.ts`

**Interfaces:**
- Produces: `createSupplier`, `updateSupplier`, `setSupplierActive`, `recordSupplierPayment`, `listSuppliers`, `getSupplierDetail`.
- Consumes: tables from Task 1 and existing authorization/audit services.

- [ ] Write tests for create/update uniqueness, payment/advance balance, chronological running balance, archive-at-zero, permissions, and rollback behavior; verify expected failures.
- [ ] Implement validation and transaction services with audit entries; make the focused test pass.
- [ ] Implement list/detail read models and run all integration tests.

### Task 3: Cost-aware receipt, sale profit, and manual adjustment

**Files:**
- Modify: `src/modules/stock/schemas.ts`
- Modify: `src/modules/stock/service.ts`
- Modify: `src/modules/stock/actions.ts`
- Modify: `src/modules/sales/service.ts`
- Modify: `src/modules/permissions/catalog.ts`
- Test: `tests/integration/stock/costing.test.ts`
- Test: `tests/integration/sales/create-sale.test.ts`

**Interfaces:**
- Produces: supplier-aware `receiveStock`, `adjustStock`, weighted-average cost calculation, captured `saleItems.unitCost`.
- Consumes: supplier and inventory tables from Tasks 1–2.

- [ ] Write failing tests for atomic supplier debt, weighted average, sale cost capture, positive/negative adjustments, insufficient stock, and archived selections.
- [ ] Extend receipt locking/transaction logic and implement adjustment with immutable movements and audit.
- [ ] Capture average cost in every created/replacement sale item and run the focused then full integration suites.

### Task 4: Accounts calculations

**Files:**
- Create: `src/modules/accounts/schemas.ts`
- Create: `src/modules/accounts/service.ts`
- Create: `src/modules/accounts/queries.ts`
- Create: `src/modules/accounts/actions.ts`
- Test: `tests/integration/accounts/accounts.test.ts`

**Interfaces:**
- Produces: `recordCapitalMovement`, `getAccountsOverview` returning capital, revenue, COGS, gross profit, expenses, net profit, inventory value, supplier debt, and advances.

- [ ] Write failing tests that independently derive all totals, exclude cancelled rows, and prove capital does not affect profit.
- [ ] Implement capital mutation/audit and aggregate queries using exact decimal arithmetic.
- [ ] Run focused and complete integration tests.

### Task 5: Bilingual supplier, medicine, receipt, adjustment, and accounts UI

**Files:**
- Create: `src/app/[locale]/(app)/suppliers/page.tsx`
- Create: `src/app/[locale]/(app)/suppliers/[id]/page.tsx`
- Create: `src/app/[locale]/(app)/medicines/[id]/page.tsx`
- Create: `src/app/[locale]/(app)/accounts/page.tsx`
- Create: `src/modules/suppliers/components/supplier-form.tsx`
- Create: `src/modules/suppliers/components/supplier-list.tsx`
- Create: `src/modules/suppliers/components/supplier-ledger.tsx`
- Create: `src/modules/accounts/components/accounts-workspace.tsx`
- Create: `src/modules/stock/components/adjust-stock-form.tsx`
- Modify: `src/modules/stock/components/receive-stock-form.tsx`
- Modify: `src/modules/medicines/components/medicine-list.tsx`
- Modify: `src/components/app-shell.tsx`
- Modify: `src/app/globals.css`
- Modify: `messages/ar.json`
- Modify: `messages/fr.json`
- Test: `tests/e2e/suppliers-accounts-medicine.spec.ts`

**Interfaces:**
- Consumes: domain actions/queries from Tasks 2–4.
- Produces: navigable responsive pages and forms in Arabic and French.

- [ ] Add failing route/UI tests for clickable medicine rows, receipt supplier/cost fields, supplier ledger/payment, stock adjustment, and accounts cards.
- [ ] Implement server pages and compact client forms using the existing action-state conventions.
- [ ] Add navigation, translations, and responsive ledger styling; verify RTL, mobile overflow, keyboard focus, and empty states.

### Task 6: Verification and documentation

**Files:**
- Modify: `Docs/03_MEDICINES_AND_STOCK.md`
- Modify: `Docs/06_EXPENSES.md`
- Modify: `Docs/07_ADMIN_DASHBOARD_AND_REPORTS.md`
- Modify: `Docs/09_UI_PAGES_AND_NAVIGATION.md`
- Modify: `Docs/12_DATA_MODEL_GUIDANCE.md`

- [ ] Run `pnpm lint`, `pnpm typecheck`, unit tests, integration tests, targeted Playwright tests, and `pnpm build`; fix every regression attributable to this change.
- [ ] Inspect desktop Arabic, desktop French, and narrow mobile screenshots; remove visual clutter and correct overflow/focus issues.
- [ ] Document formulas, legacy-data behavior, operational flow, and the new pages.
