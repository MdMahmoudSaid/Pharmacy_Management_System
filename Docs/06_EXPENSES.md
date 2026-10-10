# 06 — Expenses

## Purpose
Allow permitted users to record pharmacy expenses during daily operations.

## Expense fields
At minimum:
- ID
- Amount
- Reason / description
- Date/time
- Employee/user
- Shift if applicable
- Status
- Created at
- Created by
- Updated at
- Updated by

## Creating an expense

Flow:
1. Employee/Admin clicks Add Expense.
2. Enter amount.
3. Enter reason.
4. Date/time defaults to current time.
5. Confirm.
6. Expense is saved and linked to user and active shift when relevant.

## Validation
- Amount must be greater than 0.
- Reason should not be empty.
- Invalid negative values must be blocked.

## Editing / correcting

Authorized users can correct:
- Amount
- Reason
- Date/time if permitted
- Other allowed fields

Every correction must be auditable.

## Cancelling / deleting

Financial records should normally be cancelled/voided rather than physically removed.

If cancelled:
- It stops affecting expense totals.
- It remains in history.
- Cancellation user and time are stored.
- Optional reason is recommended.

## Reports

Expenses should be filterable by:
- Date range
- Employee
- Shift

Dashboard/report totals must exclude cancelled expenses unless explicitly viewing history.
