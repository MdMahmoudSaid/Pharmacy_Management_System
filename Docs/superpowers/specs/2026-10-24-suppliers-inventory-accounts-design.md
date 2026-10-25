# Suppliers, Medicine Ledgers, and Accounts — Design

**Date:** 2026-10-24  
**Status:** Approved by owner through expert-default execution

## Intent

Extend the pharmacy with three connected workspaces: supplier accounts, medicine inventory ledgers, and owner accounts. Stock receipt is the connecting event: it adds units to a medicine, records their cost, and increases the selected supplier's balance in one database transaction.

## Accounting model

- Supplier balance = active stock receipt cost − active supplier payments.
- A positive supplier balance is debt owed by the pharmacy; a negative balance is an advance held by the supplier.
- Supplier payments are global to the supplier and are not manually allocated to individual receipts.
- Every medicine stores a current weighted-average unit cost. A receipt recalculates it from the pre-receipt stock value plus the receipt cost.
- A sale item stores the medicine's unit cost at the moment of sale. Historical profit therefore remains stable after later receipts or price changes.
- Gross profit = active sale revenue − cost of goods sold from captured sale-item costs.
- Net profit = gross profit − active general expenses.
- Capital balance = active capital additions − active owner withdrawals. Capital movements never count as profit or expense.
- Current inventory value = sum of current medicine quantity × current average unit cost.
- Existing historical receipts and sale items migrate with zero/unknown cost and no supplier; the UI identifies them as legacy records instead of inventing debt or profit.

## Suppliers

The supplier list shows active and archived suppliers, search, total debt, total advances, purchases, and payments. Each row opens a supplier ledger.

A supplier stores name, phone, contact person, address, and note. Active supplier names are unique without regard to case. A supplier with a non-zero balance cannot be archived.

The supplier ledger contains receipt debits and payment credits in chronological order with a running balance. Its header provides edit, archive/restore, and record-payment actions. Financial rows are never hard-deleted.

## Medicines and inventory

Every medicine row is a link to a detail page. The detail page shows stock, selling price, average cost, inventory value, and margin per unit, followed by a complete movement ledger.

Receiving stock requires medicine, active supplier, positive quantity, and positive unit cost. It updates medicine stock and average cost, creates the receipt, creates the stock movement, and creates supplier debt atomically.

Manual adjustment accepts a signed non-zero quantity and a required reason. Positive adjustments use the current average cost and negative adjustments preserve it. An adjustment may not make stock negative. Every adjustment is audited and appears in the medicine ledger.

## Accounts

The accounts page is owner/admin-only and contains:

- capital balance and additions/withdrawals;
- sales revenue, cost of goods sold, gross profit, general expenses, and net profit;
- current inventory value and supplier debt/advances as context;
- a dated capital movement form and recent capital history.

The initial reporting period is all recorded history so the owner gets a stable business overview. Period filters can be added later without changing the ledger model.

## Permissions and audit

Admins retain implicit access to all features. Explicit permissions are added for supplier viewing/managing/paying, stock adjustment, and account viewing/managing. Every mutation authenticates and authorizes again on the server and appends an audit record.

## UI direction

The existing bilingual teal identity remains the visual anchor. Pages use the current warm surface, Noto families for reliable Arabic/French rendering, a single dark-teal summary panel as the bold element, white ledger surfaces, restrained status colors, generous spacing, and pill actions. Tables collapse into labeled ledger rows on narrow screens. Keyboard focus, RTL order, empty states, and reduced-motion behavior remain first-class.

## Acceptance conditions

1. A received stock entry changes medicine quantity/cost and supplier debt together or not at all.
2. A payment reduces debt and can create an advance.
3. A sale captures its contemporaneous cost and accounts compute gross/net profit from historical values.
4. Positive and negative manual adjustments are recorded; negative stock is rejected.
5. All medicine rows open a detail ledger.
6. Suppliers can be created, edited, searched, opened, paid, and archived only at zero balance.
7. Owner capital can be added or withdrawn without changing profit.
8. Arabic and French screens remain usable on desktop and mobile.
