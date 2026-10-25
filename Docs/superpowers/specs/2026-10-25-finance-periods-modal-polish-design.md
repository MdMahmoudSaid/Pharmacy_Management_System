# Finance periods and modal polish design

## Intent

Make financial actions legible and predictable, surface the most useful financial and stock signals where operators work, and let the owner inspect account performance by period without confusing period activity with current balances.

## Decisions

- Every action dialog is a fixed, viewport-centred modal on desktop and mobile.
- Dialog content explicitly resets inherited hero colours. Form labels, radio cards, help text, and errors meet readable contrast on a white panel.
- Withdrawal source cards show their names and available balances, with profit selected first and a strong selected state.
- Account period defaults to this month and offers today, this week, this month, and custom dates using the dashboard interaction pattern.
- Period filters affect revenue, COGS, gross profit, expenses, net profit, and the visible capital-movement history.
- Cash, capital, withdrawable profit, inventory value, supplier debt, and supplier advances remain current point-in-time balances.
- The dashboard adds a compact financial-position row: cash, period net profit, capital, and inventory cost value.
- The stock page adds four operational cards: units, cost value, retail value, and low/out-of-stock alerts.

## Visual system

- Keep the pharmacy's existing Noto typography and teal/white identity.
- Use one bold element per page: the cash hero on Accounts; supporting cards stay quiet.
- Selected controls use a pale teal fill, teal border, and visible inner marker. Errors use a pale red fill, red border, and dark red text.
- Cards use tabular figures and consistent label/value alignment in RTL and French.

## Responsive behaviour

- Dialogs remain centred with a maximum width and scroll internally on short screens.
- Financial and stock card grids collapse from four to two to one column.
- Period tabs wrap or scroll without clipping; custom date inputs stack on narrow screens.
