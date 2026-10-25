# 09 — UI Pages and Navigation

## General UI goals
- Simple
- Fast
- Mobile-first
- Clear buttons
- Large tap targets
- Minimal unnecessary steps
- Works well as PWA
- Also comfortable on desktop

## 1. Login
Elements:
- User identifier/login
- PIN/password according to implementation
- Login button
- Clear error message

## 2. Admin Dashboard
Show:
- Today sales
- Today expenses
- Stock summary
- Open shifts
- Recent activity
- Quick navigation

## 3. Employee Home / Shift Screen
Show:
- Current shift status
- Open Shift / Close Shift
- Quick Sale
- Add Expense
- Receive Stock
- Current shift summary

## 4. Sales Page
Show:
- Search medicine
- Add medicine to sale
- Quantity
- Price
- Total
- Confirm sale
- Print receipt

Admin/history view:
- Search/filter sales
- Open details
- Edit/correct
- Cancel if permitted
- Print

## 5. Medicines Page
Show:
- Search
- Medicine name
- Quantity
- Selling price
- Status
- Add medicine
- Edit
- Archive
- View history

Selecting a medicine opens its ledger with stock, selling price, average cost,
inventory value, recent movements, and authorized positive/negative adjustment.

## 6. Stock Page
Show:
- Receive stock
- Stock movement list
- Search/filter
- Correct stock entry if authorized
- View medicine stock history

## 7. Expenses Page
Show:
- Add expense
- Amount
- Reason
- Date/time
- Employee
- Shift
- Edit/correct
- Cancel if authorized

## 8. Shifts Page
Admin:
- All shifts
- Employee
- Open time
- Close time
- Status
- Totals
- Filters
- View details
- Correct/reopen where allowed

Employee:
- Current active shift
- Open/close controls
- Current totals

## 9. Employees Page
Admin only:
- Employee list
- Add employee
- Edit
- Disable/archive
- View activity

## 10. Reports Page
Tabs/sections:
- Sales
- Expenses
- Stock
- Stock movements
- Employees
- Shifts

Filters:
- Date
- Employee
- Shift
- Medicine where relevant

Actions:
- Print

## 11. Audit / History Page
Admin only.

Allow viewing:
- Who changed what
- When
- Old value
- New value
- Action type

## 12. Settings
Keep minimal.

Can include:
- Pharmacy/system name
- Printing preferences
- Other basic configuration if needed

Do not turn Settings into a large unrelated module.

## 13. Suppliers

Show:
- Searchable supplier directory
- Supplier contact information and status
- Total debt or advance
- Create and edit supplier
- Archive/restore controls

Selecting a supplier opens its ledger with recent receipts and payments, a
chronological running balance, and a payment form. Suppliers with a non-zero
balance cannot be archived.

## 14. Accounts

Show:
- Capital and profit summary
- Revenue, cost of goods, expenses, inventory value, and supplier balances
- Capital addition/withdrawal form
- Recent capital movement ledger

Keep the visual hierarchy compact and legible on both desktop and mobile.

## Empty states
Every list page should show a useful empty state such as:
- No sales found
- No expenses found
- No medicines found
- No open shifts

## Loading and errors
- Show loading states
- Prevent duplicate submits
- Show clear success/error feedback
