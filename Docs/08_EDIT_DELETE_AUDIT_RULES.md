# 08 — Edit, Delete, Correction and Audit Rules

This file is mandatory implementation guidance.

AI-assisted development often forgets these controls. Do not omit them.

## General rule

Relevant operational and master records must support authorized correction.

For each record type, define explicitly:
- Who can create
- Who can edit
- Who can correct
- Who can cancel/delete/archive
- Whether confirmation is required
- How history is preserved

## Records requiring edit/correction support

At minimum:
- Medicines
- Employee information
- Sales
- Sale items
- Stock receipts
- Stock corrections
- Expenses
- Shift timestamps/status where appropriate

## Confirmation dialogs

Require confirmation before:
- Cancelling a sale
- Cancelling an expense
- Correcting stock quantity
- Archiving a medicine
- Archiving an employee
- Closing/reopening a shift when relevant

Confirmation text must clearly say what will happen.

## Financial and stock records

Never silently hard-delete:
- Sales
- Expenses
- Stock movements

Use statuses, reversals, or correction records so history remains trustworthy.

## Audit log

Audit records should include:
- ID
- User ID
- User name snapshot if useful
- Entity type
- Entity ID
- Action
- Date/time
- Old values
- New values
- Optional reason
- Related shift/transaction if useful

Actions can include:
- CREATE
- UPDATE
- CANCEL
- ARCHIVE
- RESTORE
- REOPEN
- CORRECT

## Immutable history

Normal users must not be able to edit the audit log.

Audit entries should not be overwritten when another change occurs.

## Recalculation rule

If a transaction is changed:
- Recalculate related stock
- Recalculate shift totals
- Recalculate dashboard totals
- Recalculate reports

Never update one part of the system and leave another inconsistent.

## Master-data deletion

Medicines/employees with historical usage should be archived, not hard-deleted.

## UI requirements

Where editing is allowed:
- Provide visible Edit action
- Provide Save/Cancel
- Validate values
- Show confirmation for risky changes

Where deletion/cancellation is allowed:
- Provide visible action for authorized users
- Confirm before action
- Explain reversal effect if relevant
