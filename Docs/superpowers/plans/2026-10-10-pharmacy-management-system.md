# Pharmacy Management System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended for maximum independent
> review) or `superpowers:executing-plans` (recommended here for minimum token
> usage) to implement this plan task-by-task. Steps use checkbox (`- [ ]`)
> syntax for tracking.

**Goal:** Build the bilingual, mobile-first pharmacy PWA described in the
approved design, with safe corrections, fine-grained permissions, transactional
stock, reports, printing, and immutable audit history.

**Architecture:** Use one modular Next.js App Router application. Route pages and
server actions depend on domain services; domain services alone perform business
mutations through Drizzle and PostgreSQL. Financial and stock changes run in
short database transactions, while derived totals are queried from active source
transactions.

**Tech Stack:** Node.js 24 LTS, Next.js 16, React 19, TypeScript 5, PostgreSQL 18,
Drizzle ORM, `next-intl` 4, Zod, Tailwind CSS, Vitest, Testing Library, Playwright,
Docker Compose, and GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-10-pharmacy-management-system-design.md`

## Global Constraints

- Use Node.js 24 LTS and PostgreSQL 18; commit `pnpm-lock.yaml` to pin installed
  minor and patch versions.
- Use Next.js App Router with `output: "standalone"`; do not create a separate
  backend service.
- Arabic is the default locale and uses RTL; French uses LTR.
- Normalize login identifiers as `+222XXXXXXXX`; the eight local digits must
  start with `2`, `3`, or `4`.
- PINs contain exactly four digits and are stored only as Argon2id hashes.
- Money uses PostgreSQL `numeric(14,2)` and application decimal strings; never
  use JavaScript floating-point arithmetic for financial totals.
- Medicine quantities are integers; active stock must never be negative.
- Every sale, expense, and stock receipt creation requires an active shift,
  including for an administrator acting as an operator.
- Administrative corrections do not require a shift, but require permission,
  confirmation, a non-empty reason, and an audit entry.
- Employees receive explicit permissions; own-record and all-record scopes are
  distinct. Admin has every permission.
- Never hard-delete referenced users, medicines, sales, expenses, stock receipts,
  stock movements, shifts, or audit records.
- Do not implement suppliers, debts, accounting, prescriptions, insurance,
  multiple branches, customer commerce, delivery, expiry management, or offline
  transactional writes.
- The 19 scenarios in `Docs/11_ACCEPTANCE_TESTS.md` are release gates.
- Deployment execution is excluded; the repository must contain reproducible VPS
  deployment instructions and no real secret.

## Token-Efficient Execution Rules

These rules are mandatory during implementation because the user explicitly
requested the lowest practical token usage.

1. **Use native execution.** Keep one implementing agent in the current session.
   Do not dispatch one agent per task; use one fresh whole-branch reviewer only
   after all implementation tasks and release checks pass.
2. **Read narrowly.** At the start of a task, read only this task, the referenced
   spec sections, and the files named under **Files** and **Interfaces**. Do not
   reread all 13 source documents.
3. **Trust stable contracts.** Public types and function signatures in each
   **Interfaces** block are the handoff contract. Change a contract only when a
   failing test proves it necessary; update downstream plan references once.
4. **Keep modules local.** Domain code, schemas, actions, components, and tests
   stay under one named module. Avoid broad repository searches after the module
   boundary exists.
5. **Run targeted checks first.** After each edit, run the single named test file.
   Run the module suite at the end of its task and the complete suite only at the
   milestone gates in Tasks 4, 8, 11, and 13.
6. **Reuse test builders.** Put shared PostgreSQL reset logic, authenticated
   contexts, users, shifts, and medicines in `tests/factories/`; do not recreate
   fixtures in prose or code for every test.
7. **Keep command output small.** Prefer quiet reporters and targeted paths. On
   failure, inspect only the first relevant stack trace before widening scope.
8. **Avoid speculative dependencies.** Add a package only when a task names it.
   Prefer Node, React, Next.js, and PostgreSQL primitives over another abstraction.
9. **Commit per task.** A task starts from a known green state and ends with one
   focused commit, avoiding repeated rediscovery of mixed changes.
10. **Use this file as progress state.** Check completed boxes here. Do not create
    a second planning summary or repeatedly restate completed work in chat.

## Repository Structure

```text
src/
  app/
    [locale]/
      (auth)/login/page.tsx
      (app)/layout.tsx
      (app)/dashboard/page.tsx
      (app)/sales/page.tsx
      (app)/sales/[id]/page.tsx
      (app)/medicines/page.tsx
      (app)/stock/page.tsx
      (app)/expenses/page.tsx
      (app)/shifts/page.tsx
      (app)/employees/page.tsx
      (app)/reports/page.tsx
      (app)/audit/page.tsx
      (app)/settings/page.tsx
      offline/page.tsx
      layout.tsx
    manifest.ts
    globals.css
  proxy.ts
  components/
    app-shell.tsx
    confirm-reason-dialog.tsx
    data-state.tsx
    language-switcher.tsx
    money.tsx
  db/
    client.ts
    migrate.ts
    schema/
      auth.ts
      catalog.ts
      operations.ts
      audit.ts
      index.ts
  i18n/
    navigation.ts
    request.ts
    routing.ts
  lib/
    action-result.ts
    decimal.ts
    errors.ts
    time.ts
  modules/
    auth/
    permissions/
    users/
    shifts/
    medicines/
    stock/
    sales/
    expenses/
    dashboard/
    reports/
    audit/
    settings/
messages/
  ar.json
  fr.json
drizzle/
scripts/
  create-admin.ts
tests/
  factories/
  unit/
  integration/
  e2e/
```

Each module may contain only the files it needs from this set:
`schemas.ts`, `permissions.ts`, `queries.ts`, `service.ts`, `actions.ts`, and
`components/`. Do not create empty files to satisfy the diagram.

## Database Contract

| Table | Required columns and constraints |
|---|---|
| `users` | `id bigint identity PK`, `name text`, `phone_e164 text UNIQUE`, `pin_hash text`, `role ADMIN/EMPLOYEE`, `preferred_locale ar/fr DEFAULT ar`, `is_active boolean`, creator/updater IDs, `created_at`, `updated_at` |
| `sessions` | `token_hash text PK`, `user_id FK`, `expires_at`, `revoked_at`, `created_at`; index active sessions by user |
| `login_attempts` | identity ID, phone fingerprint, origin fingerprint, success, `attempted_at`; indexes for recent-window checks |
| `permissions` | `key text PK`, domain, action, scope `OWN/ALL/NONE` |
| `user_permissions` | composite PK `(user_id, permission_key)`, grantor and `granted_at` |
| `shifts` | identity ID, `user_id FK`, `opened_at`, `closed_at`, status `OPEN/CLOSED`, creator/updater metadata; partial unique index on `user_id WHERE status='OPEN'` |
| `medicines` | identity ID, name, optional code, `selling_price numeric(14,2)`, `current_stock integer CHECK >= 0`, `is_active`, creator/updater metadata; searchable indexes on normalized name and code |
| `stock_receipts` | identity ID, medicine, integer quantity, status `ACTIVE/CANCELLED`, shift, operator, note, occurrence and creator/updater metadata |
| `stock_movements` | identity ID, medicine, type, integer before/change/after, related entity type/ID, optional shift, actor, reason/note, `created_at`; no update/delete application path |
| `sales` | identity ID, unique sale number, shift, operator, `total numeric(14,2)`, status `COMPLETED/CANCELLED`, idempotency key, creator/updater metadata; unique `(operator_id,idempotency_key)` |
| `sale_items` | identity ID, sale, medicine, positive integer quantity, `unit_price numeric(14,2)`, `line_total numeric(14,2)` |
| `expenses` | identity ID, `amount numeric(14,2) CHECK > 0`, reason/description, shift, operator, status `ACTIVE/CANCELLED`, `occurred_at`, creator/updater metadata |
| `audit_logs` | identity ID, actor, entity type/ID, action, `old_values jsonb`, `new_values jsonb`, required reason for sensitive actions, optional related shift/transaction, `created_at`; no update/delete grants |
| `settings` | singleton key, pharmacy name, default locale `ar`, receipt preferences JSON, updater and `updated_at` |

All foreign keys used for joins receive indexes. Report indexes place equality
columns before date ranges. Timestamps use `timestamptz`.

## Review Focus

1. **Concurrent stock depletion:** two users selling the last units must produce
   one valid outcome and one stock error, tested in Task 8.
2. **Authorization scope:** an employee with own-record permission must be denied
   access to another employee’s record at the service boundary, tested in Task 4.
3. **Historical corrections:** correcting a closed-shift transaction must update
   derived shift, dashboard, and report totals without rewriting history, tested
   in Tasks 9–11.
4. **Locale/date boundaries:** Today and Yesterday around midnight Nouakchott
   must include exactly the correct records, tested in Task 11.
5. **Retry after uncertain network result:** resubmitting the same sale key must
   return the original sale and change stock once, tested in Task 8.

---

### Task 1: Project foundation, tests, and bilingual shell

**Files:**
- Create: `package.json`, `pnpm-lock.yaml`, `.nvmrc`, `.gitignore`, `.env.example`
- Create: `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`
- Create: `vitest.config.ts`, `vitest.integration.config.ts`, `playwright.config.ts`
- Create: `src/app/globals.css`, `src/app/[locale]/layout.tsx`, `src/app/[locale]/page.tsx`, `src/proxy.ts`
- Create: `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/i18n/navigation.ts`
- Create: `messages/ar.json`, `messages/fr.json`
- Create: `tests/unit/i18n/routing.test.ts`

**Interfaces:**
- Produces: `routing` with locales `['ar', 'fr']` and default `ar`.
- Produces: locale layout setting `<html lang>` and `dir` to `rtl` or `ltr`.
- Produces: scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test:unit`,
  `test:integration`, `test:e2e`, and `check`.

- [x] **Step 1: Initialize the repository and install only named dependencies**

Run:

```bash
git init -b main
pnpm init
pnpm add next@16 react@19 react-dom@19 next-intl@4.14.7 drizzle-orm pg zod @node-rs/argon2 decimal.js lucide-react @fontsource/noto-sans @fontsource/noto-sans-arabic
pnpm add -D typescript @types/node @types/react @types/react-dom @types/pg tailwindcss @tailwindcss/postcss eslint eslint-config-next vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test @axe-core/playwright drizzle-kit tsx sharp
```

Set `.nvmrc` to `24`, `packageManager` to the installed pnpm version, and
`next.config.ts` to combine the `next-intl` plugin with `output: 'standalone'`.
Define these scripts exactly: `dev="next dev"`, `build="next build"`,
`start="next start"`, `lint="eslint ."`, `typecheck="tsc --noEmit"`,
`test:unit="vitest run"`, `test:integration="vitest run --config
vitest.integration.config.ts"`, `test:e2e="playwright test"`, and
`check="pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration &&
pnpm build"`.
Configure the default Vitest file to include only `tests/unit/**/*.test.ts` and
`tests/unit/**/*.test.tsx`; configure the integration file to include only
`tests/integration/**/*.test.ts`.

- [x] **Step 2: Write the failing locale contract test**

```ts
import {describe, expect, it} from 'vitest';
import {directionFor, routing} from '@/i18n/routing';

describe('locale routing', () => {
  it('defaults to Arabic and maps writing directions', () => {
    expect(routing.locales).toEqual(['ar', 'fr']);
    expect(routing.defaultLocale).toBe('ar');
    expect(directionFor('ar')).toBe('rtl');
    expect(directionFor('fr')).toBe('ltr');
  });
});
```

- [x] **Step 3: Run the test and verify the missing module failure**

Run: `pnpm vitest run tests/unit/i18n/routing.test.ts`

Expected: FAIL because `@/i18n/routing` does not exist.

- [x] **Step 4: Implement routing, request configuration, translations, and shell**

```ts
import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({locales: ['ar', 'fr'], defaultLocale: 'ar'});
export type AppLocale = (typeof routing.locales)[number];
export const directionFor = (locale: AppLocale) => locale === 'ar' ? 'rtl' : 'ltr';
```

Provide matching `Common`, `Auth`, `Navigation`, and `Errors` keys in both JSON
message files. Import the two local `@fontsource` packages, then use the approved
colors and Noto Sans families in the root CSS. The initial page links to the
localized login route.

- [x] **Step 5: Verify the foundation**

Run: `pnpm vitest run tests/unit/i18n/routing.test.ts && pnpm lint && pnpm typecheck && pnpm build`

Expected: all commands PASS and the build lists localized App Router routes.

- [x] **Step 6: Commit**

```bash
git add .
git commit -m "chore: scaffold bilingual pharmacy application"
```

### Task 2: PostgreSQL schema, migrations, and test database

**Files:**
- Create: `drizzle.config.ts`, `compose.test.yml`
- Create: `src/db/client.ts`, `src/db/migrate.ts`
- Create: `src/db/schema/auth.ts`, `catalog.ts`, `operations.ts`, `audit.ts`, `index.ts`
- Create: `drizzle/0000_initial.sql`
- Create: `tests/factories/database.ts`
- Create: `tests/integration/db/schema.test.ts`

**Interfaces:**
- Produces: `db` and `DbTransaction` used by every service.
- Produces: all tables and constraints in **Database Contract**.
- Produces: `resetDatabase()` for integration tests.

- [ ] **Step 1: Start an isolated PostgreSQL 18 test service**

Use database `pharmacy_test`, a health check with `pg_isready`, a named test-only
volume, and port `55432`. Set `DATABASE_URL` in `.env.test` to that service.

Run: `docker compose -f compose.test.yml up -d --wait`

Expected: PostgreSQL reports healthy.

- [ ] **Step 2: Write failing schema constraint tests**

```ts
it('enforces one open shift per user and non-negative stock', async () => {
  const user = await createUser();
  await createShift({userId: user.id, status: 'OPEN'});
  await expect(createShift({userId: user.id, status: 'OPEN'})).rejects.toThrow();
  await expect(createMedicine({currentStock: -1})).rejects.toThrow();
});
```

Add assertions for unique normalized phone, unique sale idempotency per operator,
positive sale-item quantity, positive expense amount, and indexed foreign keys.

- [ ] **Step 3: Run the schema test and verify failure**

Run: `pnpm vitest run --config vitest.integration.config.ts tests/integration/db/schema.test.ts`

Expected: FAIL because schema and migration do not exist.

- [ ] **Step 4: Implement the schema and migration**

Create every table and constraint from **Database Contract**. Use
`bigint('id', {mode: 'number'}).primaryKey().generatedAlwaysAsIdentity()`, `timestamp` with
timezone, `numeric('field', {precision: 14, scale: 2})`, explicit checks, indexed
foreign keys, and this partial shift index:

```ts
uniqueIndex('shifts_one_open_per_user')
  .on(shifts.userId)
  .where(sql`${shifts.status} = 'OPEN'`);
```

Generate and inspect SQL with `pnpm drizzle-kit generate --name=initial`, which
creates `drizzle/0000_initial.sql`; keep Drizzle’s generated metadata files with
the migration.

- [ ] **Step 5: Apply and verify migrations**

Run: `pnpm tsx src/db/migrate.ts && pnpm vitest run --config vitest.integration.config.ts tests/integration/db/schema.test.ts`

Expected: migration applies once, reapplies as a no-op, and all constraints PASS.

- [ ] **Step 6: Commit**

```bash
git add drizzle.config.ts compose.test.yml src/db drizzle tests/factories/database.ts tests/integration/db
git commit -m "feat: add transactional pharmacy database schema"
```

### Task 3: Shared validation, money, time, and audit primitives

**Files:**
- Create: `src/lib/action-result.ts`, `decimal.ts`, `errors.ts`, `time.ts`
- Create: `src/modules/auth/schemas.ts`, `src/modules/audit/service.ts`
- Create: `tests/unit/lib/validation.test.ts`, `money.test.ts`, `time.test.ts`
- Create: `tests/integration/audit/append-only.test.ts`

**Interfaces:**
- Produces: `normalizeMauritanianPhone(local: string): string`.
- Produces: `pinSchema`, `positiveMoneySchema`, `positiveQuantitySchema`,
  `sensitiveReasonSchema`.
- Produces: `money.add`, `money.multiply`, `money.format` using decimal strings.
- Produces: `nouakchottRange(preset, now): {from: Date; to: Date}`.
- Produces: `appendAudit(tx, event): Promise<void>` with no update/delete method.

- [ ] **Step 1: Write failing parameterized validation tests**

```ts
it.each(['21234567', '31234567', '41234567'])(
  'normalizes valid local phone %s',
  local => expect(normalizeMauritanianPhone(local)).toBe(`+222${local}`)
);
it.each(['11234567', '51234567', '2123456', '212345678', '2A234567'])(
  'rejects invalid local phone %s',
  local => expect(() => normalizeMauritanianPhone(local)).toThrow()
);
it.each(['0000', '1234', '9999'])('accepts four-digit PIN %s', pin => {
  expect(pinSchema.parse(pin)).toBe(pin);
});
```

Add tests proving `0`, negative money, three decimal places, zero quantity, and
blank sensitive reasons fail; prove decimal `0.10 + 0.20` equals `0.30`.

- [ ] **Step 2: Run targeted unit tests and verify failure**

Run: `pnpm vitest run tests/unit/lib`

Expected: FAIL on missing exports.

- [ ] **Step 3: Implement the primitives**

Return discriminated action results:

```ts
export type ActionResult<T> =
  | {ok: true; data: T}
  | {ok: false; code: AppErrorCode; fieldErrors?: Record<string, string[]>};
```

Use `Decimal` for money, `Intl.NumberFormat` for display, and explicit
`Africa/Nouakchott` boundaries for report presets. `appendAudit` accepts the
current transaction object so audit and mutation commit together.

- [ ] **Step 4: Prove audit immutability at the application role**

The integration test inserts through `appendAudit`, then attempts `UPDATE` and
`DELETE` with the application database role and expects permission errors.

Run: `pnpm vitest run tests/unit/lib tests/integration/audit --config vitest.integration.config.ts`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib src/modules/auth/schemas.ts src/modules/audit tests/unit/lib tests/integration/audit
git commit -m "feat: add validated domain and audit primitives"
```

### Task 4: Authentication, sessions, permission engine, and first-admin command

**Files:**
- Create: `src/modules/auth/service.ts`, `session.ts`, `actions.ts`
- Create: `src/modules/permissions/catalog.ts`, `service.ts`
- Create: `src/modules/users/service.ts`
- Create: `scripts/create-admin.ts`
- Create: `src/app/[locale]/(auth)/login/page.tsx`
- Create: `tests/unit/permissions/service.test.ts`
- Create: `tests/integration/auth/authentication.test.ts`, `authorization.test.ts`
- Create: `tests/e2e/login.spec.ts`

**Interfaces:**
- Produces: `authenticate(phone, pin, origin): Promise<SessionView>`.
- Produces: `requireSession()`, `revokeSession()`, `revokeUserSessions(userId)`.
- Produces: `authorize(actor, permission, ownerId?): void`.
- Produces: `PermissionKey` from a fixed catalog; no string literals elsewhere.

- [ ] **Step 1: Define the fixed permission catalog and failing scope tests**

Use keys shaped as `domain.action.scope`, including sales, expenses, stock,
shifts, medicines, reports, audit, employees, PIN reset, permission management,
and settings. Test the critical boundary:

```ts
it('does not treat own scope as all scope', () => {
  const actor = employeeWith('sales.correct.own');
  expect(() => authorize(actor, 'sales.correct.own', actor.id)).not.toThrow();
  expect(() => authorize(actor, 'sales.correct.own', otherUserId)).toThrow('FORBIDDEN');
});
```

Also prove admins pass every catalog permission and disabled users fail all.

- [ ] **Step 2: Write failing authentication integration tests**

Test successful login, wrong PIN, disabled user, generic failure messages,
Argon2id hashes, session revocation, PIN reset revocation, and rate limiting after
repeated failures without storing raw phone origins or PINs in `login_attempts`.

Run: `pnpm vitest run tests/unit/permissions tests/integration/auth --config vitest.integration.config.ts`

Expected: FAIL because services do not exist.

- [ ] **Step 3: Implement authentication and authorization**

Generate 32 random bytes per session, store only a SHA-256 token hash, place the
raw token in the secure cookie, and compare PINs with Argon2id. Apply a rolling
limit of five failed attempts per phone and origin within 15 minutes, returning
the same translated error for unknown phone and wrong PIN.

The admin command accepts `--name`, `--phone`, and an interactively entered PIN;
it refuses non-interactive PIN arguments so shell history cannot capture them.

- [ ] **Step 4: Build and test the Arabic-first login page**

Render fixed `+222`, an eight-digit numeric input, a four-digit PIN input, an eye
toggle, translated errors, and no account-enumeration message. The E2E test logs
in, confirms RTL, switches to French, logs out, and confirms the saved locale.

- [ ] **Step 5: Run the first milestone gate**

Run: `pnpm check && pnpm playwright test tests/e2e/login.spec.ts`

Expected: unit, integration, lint, type, build, and login E2E checks PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/auth src/modules/permissions src/modules/users scripts src/app tests
git commit -m "feat: add secure PIN authentication and scoped permissions"
```

### Task 5: App shell and employee administration

**Files:**
- Create: `src/components/app-shell.tsx`, `language-switcher.tsx`, `data-state.tsx`
- Create: `src/app/[locale]/(app)/layout.tsx`
- Create: `src/app/[locale]/(app)/employees/page.tsx`
- Create: `src/modules/users/schemas.ts`, `queries.ts`, `actions.ts`, `components/employee-form.tsx`, `components/permission-editor.tsx`
- Create: `tests/integration/users/management.test.ts`
- Create: `tests/e2e/employees.spec.ts`

**Interfaces:**
- Consumes: `authorize`, `revokeUserSessions`, fixed permission catalog.
- Produces: create/edit/archive/restore/reset-PIN/grant/revoke user operations.
- Produces: permission-filtered mobile bottom navigation and desktop sidebar.

- [ ] **Step 1: Write failing employee lifecycle tests**

Test unique phone, Arabic default, permission grant/revoke audit, mandatory reason
for archive/restore/PIN reset/permission changes, archived login denial, session
revocation, and preservation of historical foreign keys.

Run: `pnpm vitest run --config vitest.integration.config.ts tests/integration/users/management.test.ts`

Expected: FAIL on missing user operations.

- [ ] **Step 2: Implement services and actions**

Every action validates input, calls `authorize`, executes mutation plus
`appendAudit` in one transaction, and returns `ActionResult`. Never return
`pin_hash`, session hashes, or the full permission list to an unauthorized user.

- [ ] **Step 3: Implement responsive shell and employee page**

Mobile navigation contains Home, Sale, Stock, Shift, More. Desktop uses a sidebar.
Filter every item by permission. Mirror ordering and directional icons in RTL.
Employee forms expose all fixed catalog permissions grouped by domain and scope.

- [ ] **Step 4: Verify UI and backend denial**

The E2E test creates an employee, grants one sensitive permission, signs in as
that employee, verifies unrelated navigation is absent, directly submits an
unauthorized action, and expects `FORBIDDEN` with no database change.

Run: `pnpm vitest run --config vitest.integration.config.ts tests/integration/users && pnpm playwright test tests/e2e/employees.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components src/app src/modules/users tests/integration/users tests/e2e/employees.spec.ts
git commit -m "feat: add permission-aware shell and employee management"
```

### Task 6: Shifts

**Files:**
- Create: `src/modules/shifts/schemas.ts`, `permissions.ts`, `queries.ts`, `service.ts`, `actions.ts`
- Create: `src/modules/shifts/components/shift-panel.tsx`, `shift-list.tsx`
- Create: `src/app/[locale]/(app)/shifts/page.tsx`
- Create: `tests/integration/shifts/lifecycle.test.ts`
- Create: `tests/e2e/shifts.spec.ts`

**Interfaces:**
- Produces: `openShift(actor, now)`, `closeShift(actor, shiftId, now)`,
  `correctShift(actor, input)`, `reopenShift(actor, input)`, `getShiftSummary(id)`.
- Produces: `requireActiveShift(actorId, tx?)` for operational services.

- [ ] **Step 1: Write failing shift lifecycle tests**

```ts
it('prevents a second active shift', async () => {
  await openShift(employee, firstTime);
  await expect(openShift(employee, secondTime)).rejects.toMatchObject({code: 'SHIFT_ALREADY_OPEN'});
});
```

Add close confirmation behavior, corrected timestamps, reopen with mandatory
reason, permission denial, audit values, and summaries derived from linked active
transactions.

- [ ] **Step 2: Run and verify failure**

Run: `pnpm vitest run --config vitest.integration.config.ts tests/integration/shifts`

Expected: FAIL on missing shift services.

- [ ] **Step 3: Implement shift services and UI**

Rely on the partial unique index as the race-condition backstop. Translate unique
violations into `SHIFT_ALREADY_OPEN`. Close and reopen in transactions with audit.
Show current-shift actions to operators and filtered all-shift views to authorized
users.

- [ ] **Step 4: Verify acceptance scenarios 1, 11, and 12**

Run: `pnpm vitest run --config vitest.integration.config.ts tests/integration/shifts && pnpm playwright test tests/e2e/shifts.spec.ts`

Expected: employee opens one shift, admin sees it, close summary works, and an
authorized correction/reopen is confirmed and audited.

- [ ] **Step 5: Commit**

```bash
git add src/modules/shifts src/app tests/integration/shifts tests/e2e/shifts.spec.ts
git commit -m "feat: add auditable shift lifecycle"
```

### Task 7: Medicines, stock receipts, and stock corrections

**Files:**
- Create: `src/modules/medicines/schemas.ts`, `queries.ts`, `service.ts`, `actions.ts`
- Create: `src/modules/stock/schemas.ts`, `queries.ts`, `service.ts`, `actions.ts`
- Create: `src/modules/medicines/components/medicine-list.tsx`, `medicine-form.tsx`
- Create: `src/modules/stock/components/receive-stock-form.tsx`, `movement-list.tsx`
- Create: `src/app/[locale]/(app)/medicines/page.tsx`, `src/app/[locale]/(app)/stock/page.tsx`
- Create: `tests/integration/stock/stock.test.ts`, `tests/e2e/stock.spec.ts`

**Interfaces:**
- Produces: medicine create/edit/archive/restore/search operations.
- Produces: `receiveStock(actor, input)`, `correctStockReceipt(actor, input)`,
  `getMedicineMovements(filters)`.
- Stock services accept an optional existing transaction for sale composition.

- [ ] **Step 1: Write failing stock ledger tests**

Test medicine creation, 20-unit receipt, before/change/after movement values,
shift and actor links, positive integer validation, wrong-quantity correction by
difference, wrong-medicine correction across two locked rows, archive behavior,
historical visibility, current-price change without historical rewrite, and
mandatory reasons for every sensitive action.

Run: `pnpm vitest run --config vitest.integration.config.ts tests/integration/stock/stock.test.ts`

Expected: FAIL because medicine and stock services are missing.

- [ ] **Step 2: Implement medicine and stock services**

Lock affected medicines in ascending ID order with
`SELECT id, current_stock FROM medicines WHERE id = ANY($1::bigint[]) ORDER BY id FOR UPDATE`
inside the Drizzle transaction. Update `current_stock` and insert a `stock_movements`
row together. Never update or delete an existing movement. Search only active
medicines for new operations but allow archived records in history queries.

- [ ] **Step 3: Implement mobile-first catalog and stock pages**

Provide debounced search by normalized name/code, large quantity input, explicit
confirmation, useful empty/loading/error states, movement filters, and a reason
dialog for corrections and archive/restore actions.

- [ ] **Step 4: Verify acceptance scenarios 2, 3, and 13**

Run: `pnpm vitest run --config vitest.integration.config.ts tests/integration/stock && pnpm playwright test tests/e2e/stock.spec.ts`

Expected: receipt changes stock once, movement links are correct, archive removes
new-sale selection, and history stays readable.

- [ ] **Step 5: Commit**

```bash
git add src/modules/medicines src/modules/stock src/app tests/integration/stock tests/e2e/stock.spec.ts
git commit -m "feat: add medicine catalog and immutable stock ledger"
```

### Task 8: Transactional sale creation and duplicate protection

**Files:**
- Create: `src/modules/sales/schemas.ts`, `permissions.ts`, `queries.ts`, `service.ts`, `actions.ts`
- Create: `src/modules/sales/components/medicine-search.tsx`, `sale-cart.tsx`, `sale-form.tsx`
- Create: `src/app/[locale]/(app)/sales/page.tsx`
- Create: `tests/integration/sales/create-sale.test.ts`, `concurrency.test.ts`, `idempotency.test.ts`
- Create: `tests/e2e/sale-create.spec.ts`

**Interfaces:**
- Produces: `createSale(actor, {shiftId, idempotencyKey, items})`.
- Produces: `SaleView` with historical item price strings and calculated total.
- Consumes: `requireActiveShift`, `authorize`, stock transaction helpers,
  `appendAudit`, and decimal helpers.

- [ ] **Step 1: Write failing normal and oversell tests**

```ts
it('creates one sale and decrements stock atomically', async () => {
  const sale = await createSale(employee, saleInput({quantity: 3, unitPrice: '25.50'}));
  expect(sale.total).toBe('76.50');
  expect(await stockOf(medicine.id)).toBe(17);
  expect(await saleMovementCount(sale.id)).toBe(1);
});
```

Add tests for empty cart, inactive medicine, no active shift, non-integer quantity,
price override without permission, insufficient stock with zero partial writes,
and multiple medicines locked in ascending order.

- [ ] **Step 2: Write failing concurrency and idempotency tests**

Start with stock 2. Submit two independent quantity-2 transactions concurrently;
expect one completed sale, one `INSUFFICIENT_STOCK`, final stock 0, and one sale
movement. Submit the same idempotency key twice; expect the same sale ID and one
stock change.

- [ ] **Step 3: Run targeted sale tests and verify failure**

Run: `pnpm vitest run --config vitest.integration.config.ts tests/integration/sales`

Expected: FAIL because `createSale` is missing.

- [ ] **Step 4: Implement transactional sale creation**

Validate outside the transaction when safe, then inside one short transaction:
claim or find the idempotency key, lock medicine rows in ascending order, recheck
active state and stock, calculate with `Decimal`, insert sale/items, update stock,
insert movements, append audit, and commit. Retry only PostgreSQL serialization
or deadlock errors with a small bounded retry; return the prior record for a
committed duplicate key.

- [ ] **Step 5: Implement the sale screen**

Use search-first layout, deduplicated cart rows, integer controls, historical
unit-price field gated by permission and mandatory override reason, sticky mobile
total, one generated UUID idempotency key per draft, and no success state before
the server response.

- [ ] **Step 6: Run the second milestone gate and acceptance scenarios 4, 5, 17, 18**

Run: `pnpm check && pnpm playwright test tests/e2e/sale-create.spec.ts`

Expected: all checks PASS; oversell and unauthorized override make no changes;
rapid double confirmation creates one sale.

- [ ] **Step 7: Commit**

```bash
git add src/modules/sales src/app tests/integration/sales tests/e2e/sale-create.spec.ts
git commit -m "feat: create sales with atomic stock and idempotency"
```

### Task 9: Sale correction, cancellation, history, and receipts

**Files:**
- Modify: `src/modules/sales/service.ts`, `queries.ts`, `actions.ts`
- Create: `src/modules/sales/components/sale-history.tsx`, `sale-detail.tsx`, `receipt.tsx`
- Create: `src/app/[locale]/(app)/sales/[id]/page.tsx`
- Create: `tests/integration/sales/corrections.test.ts`
- Create: `tests/e2e/sale-correction.spec.ts`, `receipt-print.spec.ts`

**Interfaces:**
- Produces: `correctSale(actor, saleId, replacementItems, reason)`.
- Produces: `cancelSale(actor, saleId, reason)` and `getSaleDetail(actor, saleId)`.
- Produces: print-only bilingual `Receipt` from immutable sale values.

- [ ] **Step 1: Write failing correction and cancellation tests**

Starting stock 20, create quantity 3, then correct to quantity 2. Assert stock 18,
new sale total, derived shift total, old/new audit values, and compensating stock
movements. Cancel and assert stock 20, status `CANCELLED`, exclusion from active
totals, retained history, and cancellation audit. Add wrong-medicine, closed-shift,
missing reason, own/all scope, already-cancelled, and insufficient replacement
stock cases.

- [ ] **Step 2: Run and verify failure**

Run: `pnpm vitest run --config vitest.integration.config.ts tests/integration/sales/corrections.test.ts`

Expected: FAIL on missing correction methods.

- [ ] **Step 3: Implement correction and cancellation transactions**

Lock the sale and union of old/new medicine IDs in stable order. Reverse the old
stock effect, validate and apply the replacement effect, replace active item
values, recalculate total, insert compensating movements, and append audit in one
transaction. Cancellation reverses once and is idempotent only when the same
already-completed command is replayed.

- [ ] **Step 4: Implement history, detail, and print CSS**

Show status, creator/updater, shift, reasoned audit timeline, and authorized
actions. Receipt print must contain pharmacy name, sale number, time, employee,
items, quantity, unit price, and total; `@media print` hides application chrome.

- [ ] **Step 5: Verify acceptance scenarios 6, 7, and receipt portion of 16**

Run: `pnpm vitest run --config vitest.integration.config.ts tests/integration/sales && pnpm playwright test tests/e2e/sale-correction.spec.ts tests/e2e/receipt-print.spec.ts`

Expected: corrections and cancellation reconcile stock and totals; print snapshot
contains no navigation.

- [ ] **Step 6: Commit**

```bash
git add src/modules/sales src/app tests/integration/sales tests/e2e
git commit -m "feat: add auditable sale corrections and receipts"
```

### Task 10: Expenses

**Files:**
- Create: `src/modules/expenses/schemas.ts`, `permissions.ts`, `queries.ts`, `service.ts`, `actions.ts`
- Create: `src/modules/expenses/components/expense-form.tsx`, `expense-list.tsx`
- Create: `src/app/[locale]/(app)/expenses/page.tsx`
- Create: `tests/integration/expenses/expenses.test.ts`
- Create: `tests/e2e/expenses.spec.ts`

**Interfaces:**
- Produces: `createExpense`, `correctExpense`, `cancelExpense`, `listExpenses`.
- Consumes: active shift, scoped authorization, decimal validation, audit.

- [ ] **Step 1: Write failing expense lifecycle tests**

Create `500.00`, assert employee and shift links and derived totals; correct to
`300.00`, assert active totals and `500.00 -> 300.00` audit; cancel, assert history
remains and active totals exclude it. Test zero, negative, three decimals, blank
description, missing shift, blank correction reason, and own/all scope denial.

- [ ] **Step 2: Run and verify failure**

Run: `pnpm vitest run --config vitest.integration.config.ts tests/integration/expenses`

Expected: FAIL on missing expense services.

- [ ] **Step 3: Implement service, actions, and page**

Store money as two-decimal strings through Drizzle numeric columns. Use status
changes rather than deletion. Build period, employee, and shift filters, with
translated states and confirmation-reason dialogs for sensitive changes.

- [ ] **Step 4: Verify acceptance scenarios 8, 9, and 10**

Run: `pnpm vitest run --config vitest.integration.config.ts tests/integration/expenses && pnpm playwright test tests/e2e/expenses.spec.ts`

Expected: PASS with active totals exactly matching source transactions.

- [ ] **Step 5: Commit**

```bash
git add src/modules/expenses src/app tests/integration/expenses tests/e2e/expenses.spec.ts
git commit -m "feat: add auditable expense lifecycle"
```

### Task 11: Dashboard, reports, audit viewer, and report printing

**Files:**
- Create: `src/modules/dashboard/queries.ts`, `components/dashboard-view.tsx`
- Create: `src/modules/reports/schemas.ts`, `queries.ts`, `components/report-tabs.tsx`, `components/report-table.tsx`
- Create: `src/modules/audit/queries.ts`, `components/audit-table.tsx`
- Create: `src/app/[locale]/(app)/dashboard/page.tsx`, `reports/page.tsx`, `audit/page.tsx`
- Create: `tests/integration/reports/reports.test.ts`, `date-boundaries.test.ts`
- Create: `tests/e2e/reports.spec.ts`, `audit.spec.ts`

**Interfaces:**
- Produces: dashboard summary for a Nouakchott business day.
- Produces: sales, expense, stock, movement, employee, and shift report queries.
- Produces: immutable audit filters and detail view.

- [ ] **Step 1: Write failing source-of-truth report tests**

Seed active, corrected, and cancelled transactions across two employees and two
shifts. Assert dashboard and every report total equals direct active-source sums;
cancelled rows remain visible with status but do not count. Correct a transaction
inside a closed shift and assert shift, dashboard, employee, and sales totals all
change without editing stored manual totals.

- [ ] **Step 2: Write failing date-boundary tests**

Use a fixed instant around midnight in `Africa/Nouakchott`. Assert Today,
Yesterday, This week, This month, and custom half-open ranges include boundary
records once and exclude the adjacent period.

- [ ] **Step 3: Implement indexed queries and permission gates**

Keep report aggregation in SQL, filter active totals by status, paginate detail
rows with stable `(created_at,id)` ordering, and use the exact range helper from
Task 3. Gate view and print separately for each report family.

- [ ] **Step 4: Implement dashboard, reports, audit, and print views**

Dashboard shows today’s sales, expenses, stock summary, open shifts, recent
activity, and employee activity without decorative charts. Reports expose the
approved presets and relevant filters. Audit shows actor, date, action, entity,
old/new values, and reason. Print CSS removes navigation and controls.

- [ ] **Step 5: Run the third milestone gate and acceptance scenarios 15, 16, 19**

Run: `pnpm check && pnpm playwright test tests/e2e/reports.spec.ts tests/e2e/audit.spec.ts`

Expected: all reports reconcile, printed sales/stock reports contain correct
values without chrome, and normal users cannot edit audit records.

- [ ] **Step 6: Commit**

```bash
git add src/modules/dashboard src/modules/reports src/modules/audit src/app tests/integration/reports tests/e2e
git commit -m "feat: add reconciled dashboard reports and audit viewer"
```

### Task 12: Settings, PWA, network behavior, and shared UI hardening

**Files:**
- Create: `src/modules/settings/schemas.ts`, `queries.ts`, `service.ts`, `actions.ts`
- Create: `src/app/[locale]/(app)/settings/page.tsx`, `src/app/manifest.ts`, `src/app/[locale]/offline/page.tsx`
- Create: `public/sw.js`, `public/icons/icon-192.png`, `public/icons/icon-512.png`
- Create: `public/icons/icon.svg`, `scripts/generate-icons.ts`
- Create: `src/components/confirm-reason-dialog.tsx`, `money.tsx`
- Modify: `src/app/globals.css`, `src/components/app-shell.tsx`
- Create: `tests/e2e/pwa-network.spec.ts`, `rtl-accessibility.spec.ts`

**Interfaces:**
- Produces: pharmacy name and print preferences used by receipt/report views.
- Produces: installable manifest and safe GET-only static shell cache.
- Produces: one shared accessible confirmation-and-reason dialog.

- [ ] **Step 1: Write failing settings and PWA tests**

Test settings permission and audit, manifest name/start URL/display/icons, service
worker registration, no caching/interception of mutation requests, offline page,
retained unsent sale draft, no false success toast, and retry with unchanged
idempotency key.

- [ ] **Step 2: Implement settings and minimal safe service worker**

Cache only versioned static assets and the offline shell on GET. Use network-first
for pages. Never queue or cache POST requests. On network failure, keep the draft
in component state or session storage, label it unsaved, and expose Retry.
Create a deterministic teal rounded-square SVG mark with a white pharmacy cross;
`scripts/generate-icons.ts` uses `sharp` to render exact 192×192 and 512×512 PNGs
from that source before the production build.

- [ ] **Step 3: Harden bilingual responsive UI**

Use approved design tokens, visible keyboard focus, descriptive labels, logical
CSS properties for RTL/LTR, direction-aware icons, large touch targets, translated
empty/loading/error states, and reduced-motion support. Run axe checks from
Playwright on login, sale, stock, dashboard, and dialog screens.

- [ ] **Step 4: Verify PWA and network behavior**

Run: `pnpm playwright test tests/e2e/pwa-network.spec.ts tests/e2e/rtl-accessibility.spec.ts`

Expected: install metadata is valid, offline mutations are refused visibly,
retries cannot duplicate sales, and sampled pages have no serious accessibility
violations.

- [ ] **Step 5: Commit**

```bash
git add src/modules/settings src/app src/components public tests/e2e
git commit -m "feat: add settings PWA shell and bilingual UI hardening"
```

### Task 13: Full acceptance suite, CI, and VPS handoff documentation

**Files:**
- Create: `tests/e2e/acceptance.spec.ts`
- Create: `.github/workflows/ci.yml`
- Create: `Dockerfile`, `compose.production.example.yml`, `.dockerignore`
- Create: `docs/DEPLOYMENT.md`, `docs/OPERATIONS.md`
- Modify: `README.md`, `.env.example`, `package.json`

**Interfaces:**
- Consumes: all prior public services and pages.
- Produces: one executable release gate covering acceptance scenarios 1–19.
- Produces: reproducible build/migrate/create-admin/start instructions for VPS
  operator without performing the deployment.

- [ ] **Step 1: Encode the 19 acceptance scenarios as named E2E tests**

Use test names `AT-01` through `AT-19`, matching the source document in order.
Use shared factories and preserve the numeric examples: receive 20, sell 3 to
reach 17, correct to 2 to reach 18, cancel to restore 20; expense 500.00,
correct to 300.00, then cancel.

- [ ] **Step 2: Run the acceptance suite and fix only proven gaps**

Run: `pnpm playwright test tests/e2e/acceptance.spec.ts`

Expected: 19 named scenarios PASS. If one fails, change the owning module and its
targeted test first, rerun that scenario, then rerun the acceptance file.

- [ ] **Step 3: Add CI gates**

GitHub Actions must use Node 24, a PostgreSQL 18 service, `pnpm install
--frozen-lockfile`, migrations, `pnpm lint`, `pnpm typecheck`, unit tests,
integration tests, production build, and Playwright acceptance tests. Cache only
the pnpm store and Playwright browsers keyed by lockfile.

- [ ] **Step 4: Add production packaging and handoff docs**

Use a multi-stage Node 24 image copying Next.js standalone output plus
`public/` and `.next/static/`. The production compose example contains the app,
PostgreSQL 18, persistent volume, health checks, restart policy, and environment
variable names with no values. Document reverse proxy/TLS, backups, restore drill,
migrations, first-admin command, log inspection, health check, update, and rollback.

- [ ] **Step 5: Run the final gate**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm build
pnpm test:e2e
docker build -t pharmacy-management-system:test .
```

Expected: every command exits 0; acceptance output lists `AT-01` through `AT-19`
as passed; the image starts and responds to its health endpoint.

- [ ] **Step 6: Perform the final security and completeness review**

Confirm no secret is tracked, no PIN/token appears in logs or snapshots, no
employee API returns admin-only fields, all sensitive actions require reasons,
all database mutation paths call authorization, and all stock/financial
corrections run inside transactions with audit.

- [ ] **Step 7: Commit**

```bash
git add .github Dockerfile compose.production.example.yml .dockerignore docs README.md .env.example package.json tests/e2e/acceptance.spec.ts
git commit -m "chore: add release gates and VPS handoff"
```

## Acceptance Coverage Map

| Source scenario | Owning task |
|---|---:|
| 1 Employee shift | 6 |
| 2 Add medicine | 7 |
| 3 Receive stock | 7 |
| 4 Make sale | 8 |
| 5 Prevent overselling | 8 |
| 6 Correct sale quantity | 9 |
| 7 Cancel sale | 9 |
| 8 Expense | 10 |
| 9 Correct expense | 10 |
| 10 Cancel expense | 10 |
| 11 Close shift | 6 |
| 12 Correct shift | 6 |
| 13 Archive medicine | 7 |
| 14 Disable employee | 5 |
| 15 Reports | 11 |
| 16 Printing | 9 and 11 |
| 17 Permissions | 4 and 5 |
| 18 Duplicate submission | 8 |
| 19 Audit integrity | 3 and 11 |

## Milestone Verification Policy

- Tasks 1–4: foundation gate; run the full check once at Task 4.
- Tasks 5–8: operational-core gate; run the full check once at Task 8.
- Tasks 9–11: correction/reporting gate; run the full check once at Task 11.
- Tasks 12–13: release gate; run the complete suite once at Task 13.
- Between gates, run only the test files named by the active task unless a shared
  contract changes.

This policy intentionally minimizes repeated test output and context loading
without weakening final verification.
