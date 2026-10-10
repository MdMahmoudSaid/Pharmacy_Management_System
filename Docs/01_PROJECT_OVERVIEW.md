# 01 — Project Overview

## Project
Pharmacy Management System

## Purpose
Build a simple internal pharmacy management application that allows the owner/admin to monitor the pharmacy clearly and allows employees to record daily activity correctly.

The app must work as a PWA on:
- Mobile phones
- Tablets
- Desktop computers

## Main users
1. Admin / Owner
2. Employee

## Main business flow
1. Employee logs in.
2. Employee opens a shift.
3. Employee performs sales during the shift.
4. Each sale reduces stock automatically.
5. Employee can register received stock.
6. Employee can register permitted expenses.
7. Employee closes the shift.
8. Admin sees all activity, totals, stock, shifts, employees and reports.

## Main modules
- Authentication
- Users and roles
- Employees
- Shifts
- Medicines
- Stock
- Sales
- Expenses
- Dashboard
- Reports
- Printing
- Audit history

## Core implementation principle
The application must not be designed only for the happy path.

The system must support real operational corrections. Authorized users must be able to fix mistakes without corrupting stock, financial totals, shift totals, or history.

## Data integrity
Every important record should keep:
- Created by
- Created at
- Last updated by
- Last updated at
- Status where relevant
- Audit history for important edits/deletions/corrections

## Currency
MRU

## Version scope
This is a single-pharmacy internal management system.

Not included:
- Supplier ledger/accounting
- Supplier debt
- Full accounting
- Insurance workflows
- Prescription workflows
- Multiple pharmacy branches
- Customer app
- Delivery
- E-commerce
- Advanced expiry alert system
