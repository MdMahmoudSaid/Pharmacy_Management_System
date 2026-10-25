# 03 — Medicines and Stock

## Medicine catalog

Each medicine should support at minimum:
- ID
- Name
- Optional internal code
- Selling price
- Weighted-average purchase cost
- Current stock quantity
- Active / Archived status
- Created at
- Created by
- Updated at
- Updated by

Optional fields can be added only if they are useful and do not complicate the project unnecessarily.

## Medicine list

Users with permission can:
- Search medicines by name
- View available quantity
- View selling price
- Open medicine details
- Add a medicine
- Edit medicine information
- Archive a medicine

Search must be fast and easy on mobile.

## Receiving stock

When new stock arrives:
1. Employee/Admin searches for an existing medicine.
2. If found:
   - Select medicine
   - Enter quantity received
   - Select the supplier
   - Enter the unit purchase cost
   - Confirm
3. If not found:
   - Create medicine
   - Enter initial quantity
   - Enter selling price
   - Confirm

A stock-receiving entry must store:
- Medicine
- Quantity received
- Date/time
- User who registered it
- Shift if registered during an employee shift
- Optional note
- Supplier
- Unit purchase cost
- Total purchase cost

Confirming a receipt is one atomic operation: it increases stock, updates the
medicine's weighted-average cost, records the movement, and adds the same total
as debt in the selected supplier ledger. If any part fails, nothing is saved.

The weighted-average cost after a receipt is:

`(old quantity × old average cost + received quantity × unit cost) ÷ new quantity`

Each sale item stores the weighted-average cost that was current at the moment
of sale. Later receipts therefore do not rewrite historical profit.

## Stock movement history

Every stock-affecting action must create a stock movement record.

Movement types can include:
- Stock received
- Sale
- Sale cancellation
- Sale correction
- Manual stock correction
- Other authorized adjustment

Each movement should store:
- Medicine
- Quantity before
- Quantity change
- Quantity after
- Movement type
- Related record ID if applicable
- User
- Date/time
- Optional note/reason

## Stock correction

Authorized users must be able to correct mistakes.

Examples:
- Wrong quantity received
- Wrong medicine selected
- Wrong sale quantity
- Duplicate stock entry

Stock corrections must never silently overwrite history.

The system must preserve the original action and log the correction.

Authorized users can also make an explicit positive or negative inventory
adjustment from the medicine ledger when the physical count differs from the
application. A reason is required, the before/after quantities are recorded,
and an adjustment may never produce negative stock. This operational correction
does not create supplier debt.

## Medicine ledger

Every medicine row opens a dedicated ledger showing:
- Current quantity
- Selling price
- Weighted-average purchase cost
- Current inventory value
- Recent receipts and movements
- Supplier and receipt cost where applicable
- Authorized controls to add or subtract stock

## Negative stock

By default:
- Do not allow a sale that makes stock negative.

If a future client explicitly requests negative stock support, treat it as a separate business rule.

## Deleting medicines

If a medicine has transaction history:
- Do not hard-delete it.
- Archive it instead.

Archived medicines:
- Must stay visible in old records/reports.
- Must not appear as an active medicine for new sales unless restored.

## Editing price

Authorized users can edit the default selling price.

Changing the medicine's current price must NOT rewrite historical sale prices.

Each sale stores the exact price used at the time of sale.
