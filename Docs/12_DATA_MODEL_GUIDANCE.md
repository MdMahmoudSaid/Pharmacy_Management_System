# 12 — Data Model Guidance

This is guidance, not a mandatory ORM/schema implementation.

## Suggested entities

### User
- id
- name
- login identifier
- password/PIN hash
- role
- active
- createdAt
- updatedAt

### Employee
Can be combined with User if architecture allows.
- id
- userId
- displayName
- active

### Shift
- id
- employeeId
- openedAt
- closedAt
- status
- createdAt
- updatedAt

### Medicine
- id
- name
- code optional
- sellingPrice
- active
- createdAt
- updatedAt

Do not rely on a single mutable stock number without stock movement history.

### StockMovement
- id
- medicineId
- type
- quantityChange
- quantityBefore
- quantityAfter
- relatedEntityType
- relatedEntityId
- shiftId optional
- userId
- note optional
- createdAt

### Sale
- id
- saleNumber
- shiftId
- employeeId
- total
- status
- createdAt
- updatedAt

### SaleItem
- id
- saleId
- medicineId
- quantity
- unitPrice
- lineTotal

### Expense
- id
- amount
- reason
- shiftId optional
- userId
- status
- occurredAt
- createdAt
- updatedAt

### AuditLog
- id
- userId
- entityType
- entityId
- action
- oldValues JSON
- newValues JSON
- reason optional
- createdAt

## Referential integrity

Do not physically delete records that are referenced by historical transactions.

Use:
- active flags
- archived status
- cancelled status

## Transactions

Use database transactions for operations that affect multiple records.

Example sale transaction:
1. Validate active shift.
2. Validate stock.
3. Create sale.
4. Create sale items.
5. Create stock movements.
6. Update stock state if using cached stock quantity.
7. Commit.

If any step fails, rollback.

## Stock source of truth

Preferred approach:
- Keep an immutable stock movement ledger.
- Optionally maintain current stock as a cached/derived field for speed.
- Ensure current stock stays consistent with movement history.

## Audit source of truth

Audit history must be append-only for normal application users.
