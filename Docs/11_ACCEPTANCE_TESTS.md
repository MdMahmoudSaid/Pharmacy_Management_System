# 11 — Acceptance Tests

The project is not considered functionally complete until the following scenarios work.

## Test 1 — Employee shift
1. Create employee.
2. Employee logs in.
3. Employee opens shift.
4. System records open time.
5. Admin sees shift as open.

Expected:
- One active shift only.
- Employee cannot accidentally create a second active shift.

## Test 2 — Add medicine
1. Admin creates medicine.
2. Set price.
3. Set/add stock.

Expected:
- Medicine appears in search.
- Correct price and stock displayed.

## Test 3 — Receive stock
1. Employee with active shift receives 20 units.
2. Confirm.

Expected:
- Stock increases by 20.
- Stock movement created.
- User and shift are recorded.
- Admin can see entry.

## Test 4 — Make sale
Starting stock: 20.

1. Employee sells quantity 3.
2. Confirm price.
3. Complete sale.

Expected:
- Sale saved.
- Sale linked to employee and shift.
- Stock becomes 17.
- Stock movement created.
- Shift sales total updates.
- Dashboard updates.
- Receipt can be printed.

## Test 5 — Prevent overselling
Starting stock: 2.

Try to sell quantity 3.

Expected:
- Sale blocked.
- Clear error.
- No stock or financial changes.

## Test 6 — Correct sale quantity
Starting stock after sale: 17.

Original sale quantity: 3.
Admin changes quantity to 2.

Expected:
- Stock becomes 18.
- Sale total recalculates.
- Shift total recalculates.
- Dashboard/report totals recalculate.
- Audit log stores old and new quantity.

## Test 7 — Cancel sale
Cancel the sale from Test 6.

Expected:
- Stock restores to 20.
- Sale status becomes Cancelled.
- Sale remains visible in history.
- Sale no longer counts in active sales totals.
- Audit record created.

## Test 8 — Expense
1. Employee records expense 500 MRU.
2. Reason entered.

Expected:
- Expense linked to employee and shift.
- Dashboard expenses increase.
- Shift expense total updates.

## Test 9 — Correct expense
Change 500 MRU to 300 MRU.

Expected:
- Totals update to 300.
- Audit history stores 500 -> 300.

## Test 10 — Cancel expense
Cancel the expense.

Expected:
- Expense remains in history.
- Active expense totals decrease.
- Audit event exists.

## Test 11 — Close shift
1. Employee closes shift.

Expected:
- Close time saved.
- Shift status closed.
- Summary shows sales, expenses and stock activity.
- Admin can view it.

## Test 12 — Correct shift
Admin corrects an accidental closing time or reopens if feature is implemented.

Expected:
- Permission check.
- Confirmation.
- Audit record.
- No history loss.

## Test 13 — Archive medicine
Archive a medicine with transaction history.

Expected:
- Medicine disappears from normal new-sale selection.
- Old sales still display medicine correctly.
- History remains intact.

## Test 14 — Disable employee
Disable employee with historical activity.

Expected:
- Employee cannot log in.
- Old sales/shifts still display employee.
- Historical records are not deleted.

## Test 15 — Reports
Generate:
- Sales report
- Expense report
- Stock report
- Employee report
- Shift report

Expected:
- Filters work.
- Cancelled items do not incorrectly count in active totals.
- Data matches source transactions.

## Test 16 — Printing
Print:
- Sale receipt
- Sales report
- Stock report

Expected:
- Clean print layout.
- Correct values.
- No navigation UI in print.

## Test 17 — Permissions
Employee attempts admin-only action.

Expected:
- UI hides or disables it where appropriate.
- Backend also rejects unauthorized request.

## Test 18 — Duplicate submission
Rapidly click Confirm Sale twice.

Expected:
- Only one sale is created.
- Stock changes once.

## Test 19 — Audit integrity
Perform several edits/cancellations.

Expected:
- Admin can see:
  - Who changed the record
  - When
  - Old value
  - New value
  - Action type

Normal users cannot edit audit records.

## Final acceptance principle
If a normal operational mistake cannot be corrected safely, the system is not ready.
