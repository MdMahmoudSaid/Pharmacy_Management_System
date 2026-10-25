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
- averageCost
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
- unitCost (historical cost snapshot)
- lineTotal

### Supplier
- id
- name (case-insensitive unique among active suppliers)
- phone optional
- address optional
- notes optional
- active
- createdAt
- updatedAt

### StockReceipt
- id
- medicineId
- supplierId
- quantity
- unitCost
- totalCost
- status
- receivedAt
- userId
- shiftId optional

### SupplierPayment
- id
- supplierId
- amount
- status
- paidAt
- userId
- note optional

Supplier balance is ledger-derived: active receipt totals minus active payment
totals. A negative balance is an advance/credit held with the supplier.

### CapitalMovement
- id
- type (addition or withdrawal)
- amount
- occurredAt
- userId
- note optional
- status

Capital balance is additions minus withdrawals. Capital movements remain
separate from revenue, cost of goods sold, and expenses.

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
