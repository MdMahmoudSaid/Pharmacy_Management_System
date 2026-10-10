# 04 — Sales Workflow

## Basic sale flow

1. Employee must have an active shift.
2. Employee opens the Sales page.
3. Search medicine by name.
4. Select medicine.
5. Enter quantity.
6. Confirm or enter the sale price if the employee has permission to change it.
7. Review sale summary.
8. Confirm sale.
9. System:
   - Creates sale record
   - Creates sale item(s)
   - Records total amount
   - Links sale to employee
   - Links sale to active shift
   - Reduces stock
   - Creates stock movement
   - Updates shift totals
10. Receipt can be printed.

## Sale data

Each sale should store:
- Sale number / ID
- Date/time
- Employee
- Shift
- Total amount
- Status
- Created at
- Created by
- Last updated at
- Last updated by

Each sale item should store:
- Medicine
- Quantity
- Unit sale price
- Line total

## Sale statuses

Suggested statuses:
- Completed
- Cancelled

If edits are implemented directly instead of versioning status changes, audit history is still mandatory.

## Editing / correcting a sale

Authorized users must be able to correct a sale.

Examples:
- Wrong quantity
- Wrong medicine
- Wrong selling price

When a sale is corrected:
1. Calculate difference between old and new sale.
2. Recalculate stock.
3. Recalculate sale total.
4. Recalculate shift total.
5. Recalculate relevant reports.
6. Add audit record with old and new values.

Never only change the displayed value while leaving stock or totals unchanged.

## Cancelling / deleting a sale

A sale should normally be cancelled rather than physically erased.

When cancelled:
- Restore stock quantities
- Reverse its effect on shift totals
- Reverse its effect on sales reports
- Keep the sale in history with Cancelled status
- Record who cancelled it and when
- Optional reason field is recommended

## Duplicate protection

Prevent accidental duplicate sale creation from:
- Double-clicking
- Repeated mobile taps
- Network retries

Use transactional/idempotent backend logic where appropriate.

## Receipt printing

Receipt should include at minimum:
- Pharmacy/system name if configured
- Sale ID
- Date/time
- Employee
- Medicine(s)
- Quantity
- Unit price
- Total

The print layout should be readable on standard receipt/print formats supported by the browser.

## Historical price rule

Historical sales must preserve the price used at the time of sale even if the medicine's default price later changes.
