# Pharmacy Management System — Developer Package

This folder is the source of truth for the Pharmacy Management System.

## How to use this package
1. Read the files in numeric order before implementation.
2. Do not invent extra features that are not described.
3. Do not remove operational controls because they look "obvious".
4. For all important operational data, explicitly support authorized:
   - Create
   - View
   - Edit
   - Correct
   - Delete / Archive where appropriate
5. Destructive or financially meaningful actions must require confirmation.
6. Important changes must be traceable in an immutable audit/history trail.
7. If a sale, stock entry, expense, or other financial/stock transaction is corrected or cancelled, all affected totals and stock quantities must be recalculated consistently.
8. Mobile usability is a priority. The system is a PWA and must also work well on desktop.
9. Currency: MRU.
10. Before coding, produce a short implementation plan and confirm that every acceptance scenario in `11_ACCEPTANCE_TESTS.md` is covered.

## Included system areas
- Admin / Owner account
- Employee accounts
- Shift management
- Medicine catalog
- Stock management
- Sales
- Expenses
- Dashboard
- Reports
- Printing
- Audit/history
- PWA usage on phone and desktop

## Explicitly not included in this version
- Supplier accounts
- Supplier debt management
- Full accounting system
- Prescription management
- Insurance management
- Multi-branch management
- Customer-facing app
- E-commerce
- Delivery
- Advanced expiry alerts
- External accounting integrations
- Special hardware integrations unless separately agreed
