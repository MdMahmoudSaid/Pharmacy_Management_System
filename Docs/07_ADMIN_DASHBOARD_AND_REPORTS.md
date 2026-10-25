# 07 — Admin Dashboard and Reports

## Admin dashboard

The dashboard should provide a simple overview.

At minimum show:
- Today's sales total
- Today's expenses total
- Current stock summary
- Number of open shifts
- Recent activity
- Employee activity summary

Avoid overloading the dashboard with unnecessary charts.

## Accounts workspace

The separate Accounts page is the financial control surface for permitted
owners/admins. It shows:
- Current capital balance
- Sales revenue
- Cost of goods sold
- Gross profit
- Active general expenses
- Net profit
- Inventory value at weighted-average cost
- Supplier debt and supplier advances

Capital additions and withdrawals are recorded as an auditable ledger. Capital
is kept separate from profit: adding owner money is not revenue, and withdrawing
capital is not an operating expense. A withdrawal cannot exceed the current
capital balance.

## Recent activity

Recent activity can include:
- Sale completed
- Sale corrected/cancelled
- Expense created/corrected/cancelled
- Stock received
- Stock correction
- Shift opened
- Shift closed

## Reports

### Sales report
Filters:
- Date range
- Employee
- Shift

Show:
- Sale ID
- Date
- Employee
- Total
- Status

### Expense report
Filters:
- Date range
- Employee
- Shift

### Stock report
Show:
- Medicine
- Current quantity
- Current selling price
- Status

### Stock movement report
Filters:
- Medicine
- Date range
- Movement type
- User

### Employee report
Show:
- Employee
- Number of shifts
- Sales count
- Sales total
- Expenses registered
- Stock entries registered

### Shift report
Show:
- Employee
- Open time
- Close time
- Sales
- Expenses
- Stock activity
- Status

## Date filtering

Date filtering must be consistent across the system.

Recommended presets:
- Today
- Yesterday
- This week
- This month
- Custom range

## Printing

Reports should support clean browser printing.

Do not print navigation bars or irrelevant UI.

## Corrected/cancelled records

Reports must clearly distinguish active and cancelled records.

Cancelled sales and expenses should not affect active totals.
