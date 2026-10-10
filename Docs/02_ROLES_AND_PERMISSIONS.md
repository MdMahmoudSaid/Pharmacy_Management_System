# 02 — Roles and Permissions

## Role 1: Admin / Owner

The Admin can:
- View the full dashboard
- View all employees
- Create employees
- Edit employees
- Disable/archive employees
- Reset employee credentials if needed
- View all shifts
- View open and closed shifts
- Correct shift information when necessary
- View all medicines
- Create medicines
- Edit medicines
- Archive/delete medicines where safe
- View stock
- Receive/register stock
- Correct stock entries
- View all sales
- Correct/edit sales
- Cancel/delete sales where permitted
- View and manage expenses
- Edit/correct/delete expenses where permitted
- View all reports
- Print receipts and reports
- View audit/history
- View who created or changed records

## Role 2: Employee

The Employee can:
- Log in to their own account
- Open a shift
- View their active shift
- Search medicines
- Create sales
- Receive/register stock if permitted by business rules
- Record expenses if permitted
- Close their shift
- View their own relevant activity

Employee access should be limited to operational tasks.

By default, employees should NOT:
- View full business-wide profit/financial reporting
- Manage other employees
- Change admin settings
- Delete sensitive historical records without permission
- Access admin-only audit logs

## Permission rules

Do not hard-code UI-only permissions.

Permissions must also be enforced on the backend/API.

For all important actions:
- Create
- Edit
- Correct
- Delete
- Cancel
- Reopen
- Print
- View reports

the backend must verify the user's role/permission.

## Delete vs Archive

For master data such as medicines or employees:
- Prefer Archive/Disable when the item has historical transactions.
- Never permanently remove a medicine or employee if doing so would break old sales, shifts, stock movements or audit records.

## Confirmation

Require confirmation before:
- Deleting/cancelling a sale
- Deleting/cancelling an expense
- Correcting stock quantities
- Archiving a medicine
- Archiving an employee
- Closing or reopening a shift where applicable

## Audit requirement

Important changes must record:
- User who made the change
- Date/time
- Entity changed
- Record ID
- Old value
- New value
- Action type
- Optional reason/note when useful
