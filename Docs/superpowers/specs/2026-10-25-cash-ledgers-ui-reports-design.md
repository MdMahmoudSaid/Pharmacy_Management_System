# Cash, ledgers, and operational UI design

## Intent

Make the supplier, medicine, stock, accounts, dashboard, and reports areas behave as one operational system. Money leaving the pharmacy must be backed by actual cash, accounting profit must remain distinct from contributed capital, and common supplier/medicine actions must be clear without permanently occupying page space.

## Product decisions

- The cash balance is: active capital additions + completed sales - active expenses - active supplier payments - all active owner withdrawals.
- Receiving stock on supplier credit changes inventory and supplier debt, not cash. Cash changes only when the supplier is paid.
- Accounting profit is cumulative completed-sales revenue minus historical COGS minus active general expenses. Supplier payments are debt settlement and do not reduce profit a second time.
- Withdrawable profit is accounting profit minus the profit-funded portions of previous owner withdrawals, floored at zero.
- Available capital is contributed capital minus the capital-funded portions of owner withdrawals.
- An owner withdrawal defaults to profit. If the requested amount exceeds withdrawable profit, the UI shows the capital remainder and requires an explicit confirmation before splitting the withdrawal between profit and capital.
- Expenses, supplier payments, and owner withdrawals are rejected atomically when cash is insufficient. Corrections that increase an expense are checked only for the additional amount.
- A shared PostgreSQL advisory transaction lock serializes cash-out validation. Monetary values remain `numeric(14,2)` and allocations are stored, not reconstructed later.
- Existing owner withdrawals are migrated as capital-funded so historical capital totals do not change unexpectedly.
- A stock receipt shows total purchase cost live. It proposes a selling price at 20% above the projected weighted-average cost, rounded to two decimals. The operator may change it, but the stored price must remain strictly greater than the projected average cost.

## Supplier experience

- Supplier list rows use a stable four-column desktop grid: identity, purchases, payments, balance. Each amount is directly below its label and aligned with tabular numerals.
- The supplier detail hero separates status/contact from the balance. Purchases, payments, and balance use wider metric cards.
- Edit, archive/restore, and payment are compact buttons in the page action bar. Each opens an accessible modal; forms do not remain expanded in the page flow.
- The ledger owns the full page width and remains a table on desktop, readable stacked rows on phones.
- The dashboard shows a supplier strip beneath the existing operational metrics: total purchases, total payments, and outstanding debt, each linking to suppliers.

## Medicine and stock experience

- Medicine catalogue rows are single clickable records. Inline edit/archive panels are removed.
- The medicine detail page owns edit, archive/restore, and stock-adjustment actions in modals.
- The medicine ledger continues to show all incoming and outgoing movement types with before/after stock, actor, date, supplier, and cost when applicable.
- Stock adjustment uses an explicit plus/minus selector, a positive quantity field, a required reason, and previews the signed change.
- Receipt entry shows projected stock, projected average cost, total purchase cost, the 20% suggestion, and an editable new selling price.

## Accounts experience

- The top of Accounts presents cash, available capital, accounting profit, and withdrawable profit as distinct figures with plain explanations.
- The movement modal separates capital contribution from owner withdrawal. Withdrawal source defaults to profit.
- If profit is insufficient, the modal explains the exact profit portion and capital remainder and asks for explicit confirmation.
- History labels each withdrawal as profit-funded, capital-funded, or mixed.

## Reports

- Add an Accounts group with a cash-flow report for a selected period. It lists sales and capital inflows, then expenses, supplier payments, and owner withdrawals as outflows with a running cash balance.
- Add a Suppliers group with a supplier-balances snapshot showing supplier, purchases, payments, balance, and status.
- Both reuse the existing printable/PDF report pipeline and bilingual formatting.

## UI direction

- Preserve the pharmacy's teal, white, and quiet gray identity and locally bundled Arabic/Latin Noto fonts.
- Use one bold area per screen: the supplier/medicine identity hero or the accounts cash panel. Everything else is restrained, spacious, and information-led.
- Buttons are compact pills; destructive actions are red only inside their modal. Modal opening/closing is the only new motion.
- Desktop content width grows to avoid cramped ledgers; mobile layouts stack without horizontal page overflow.

## Acceptance checks

- A supplier payment or expense cannot make cash negative, including under concurrent requests.
- Profit and capital withdrawals consume the correct buckets and cash; a mixed withdrawal requires explicit consent.
- Supplier list values align under the correct labels at desktop and phone widths.
- Supplier and medicine edit/archive/payment/adjustment controls open modals and preserve keyboard focus behavior.
- Receipt total, projected cost, and suggested price update as inputs change; the server rejects a non-profitable price.
- Dashboard supplier metrics reconcile to supplier totals.
- Accounts and supplier reports render, filter where applicable, print, and export through the existing report components.

