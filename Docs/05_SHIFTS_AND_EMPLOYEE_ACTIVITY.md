# 05 — Shifts and Employee Activity

## Opening a shift

Employee flow:
1. Log in.
2. If no active shift exists, show Open Shift action.
3. Employee confirms opening.
4. System records:
   - Employee
   - Open date/time
   - Status = Open

## Active shift

All employee operational activity during an open shift should be linked to that shift:
- Sales
- Expenses
- Stock received

## Closing a shift

Employee:
1. Opens current shift.
2. Reviews summary.
3. Clicks Close Shift.
4. Confirms.
5. System records closing time and status.

Shift summary should show:
- Opening time
- Closing time
- Number of sales
- Sales total
- Expenses total
- Stock receipts / stock entries
- Other useful activity totals

## One active shift rule

Default rule:
- An employee can have only one active shift at a time.

If they already have an open shift:
- Do not allow another one.
- Redirect to the active shift.

## Admin shift view

Admin can:
- View all shifts
- Filter by employee
- Filter by date
- View open shifts
- View closed shifts
- Open shift details
- View all records linked to the shift

## Shift corrections

Real-world mistakes must be repairable.

Authorized Admin can correct:
- Wrong opening time
- Wrong closing time
- Accidental close

If reopening is supported:
- Reopen only with confirmation
- Log audit event

Never silently rewrite shift timestamps without history.

## Shift totals

Shift totals must be calculated from linked transactions.

Do not rely only on stored manual totals.

If a linked sale or expense is corrected/cancelled:
- Shift totals must update automatically.

## Employee activity

Admin should be able to see:
- Employee name
- Shift times
- Sales count
- Sales value
- Expenses registered
- Stock received
- Recent activity
