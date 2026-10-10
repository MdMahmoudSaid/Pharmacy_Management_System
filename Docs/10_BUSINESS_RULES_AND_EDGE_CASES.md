# 10 — Business Rules and Edge Cases

## Sales
- Employee should normally have an active shift before making a sale.
- Quantity must be positive.
- Price must be valid.
- Do not allow selling more than available stock.
- Double-click/retry must not create duplicate sales.
- Historical sale price must remain unchanged if medicine price changes later.

## Sale correction
If quantity changes:
- Restore old stock effect
- Apply new stock effect
- Recalculate totals

If medicine changes:
- Restore stock to old medicine
- Reduce stock from new medicine

If sale is cancelled:
- Restore stock
- Remove sale from active financial totals
- Keep historical record

## Stock
- Received quantity must be positive.
- A stock receipt increases quantity.
- Correcting a stock receipt must correctly apply the difference.
- Stock movement history must remain traceable.
- Stock quantity shown to users must match transaction effects.

## Expenses
- Amount must be positive.
- Cancelled expenses must not count in active totals.
- Corrected expenses must update dashboard/report totals.

## Shifts
- One employee should not have two active shifts at the same time.
- Closed shifts remain viewable.
- If historical transactions inside a shift are corrected, the shift summary must recalculate.
- Accidental close must be recoverable by authorized admin if reopening is supported.

## Employees
- Disabled employee cannot log in.
- Historical records must still show that employee.
- Deleting/archiving an employee must not erase transaction history.

## Medicines
- Archived medicine remains visible in historical transactions.
- Archived medicine is not selectable for new sales by default.
- Existing transaction history cannot be broken by renaming or archiving a medicine.

## Dates and time
- Store timestamps consistently.
- Display local date/time clearly.
- Reports must use consistent date boundaries.

## PWA/network behavior
At minimum:
- App should install as PWA.
- UI should handle temporary network failure gracefully.
- Do not show a successful sale before the server confirms persistence.
- Prevent repeated submission after reconnection.

Full offline transactional sales are NOT automatically required unless specifically implemented and tested.

## Security
- Backend authorization is mandatory.
- Password/PIN data must be stored securely.
- Do not expose sensitive admin data to employee APIs.
- Validate all inputs server-side.

## Data integrity
Important multi-step operations should use database transactions when possible.

Example:
Creating a sale and reducing stock should either both succeed or both fail.

## Printing
If browser print is used:
- Print view must be clean
- No navigation/sidebar
- Correct totals
- Correct transaction details

## Out-of-scope edge cases
Do not add major new modules for:
- Supplier debts
- Accounting
- Insurance
- Prescriptions
- Multiple branches
unless separately approved.
