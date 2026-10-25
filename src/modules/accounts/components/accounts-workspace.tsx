'use client';

import {useTranslations} from 'next-intl';
import {Plus} from 'lucide-react';
import {useActionState, useState} from 'react';

import {ActionDialog} from '@/components/action-dialog';
import {recordCapitalMovementAction, type AccountActionState} from '../actions';

type Summary = {cash: string; capital: string; withdrawableProfit: string; revenue: string; costOfGoods: string; grossProfit: string; expenses: string; netProfit: string; inventoryValue: string; supplierDebt: string; supplierAdvances: string};
type Movement = {id: number; type: 'ADDITION' | 'WITHDRAWAL'; amount: string; profitPortion: string; capitalPortion: string; note: string | null; occurredAt: Date; operatorName: string};
const money = (value: string) => `${new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(Number(value))} MRU`;

export function AccountsWorkspace({summary, movements, periodCaption, locale, canManage}: {summary: Summary; movements: Movement[]; periodCaption: string; locale: 'ar' | 'fr'; canManage: boolean}) {
  const t = useTranslations('Accounts');
  const [state, action, pending] = useActionState<AccountActionState, FormData>(recordCapitalMovementAction, undefined);
  const [type, setType] = useState<'ADDITION' | 'WITHDRAWAL'>('ADDITION');
  const [source, setSource] = useState<'PROFIT' | 'CAPITAL'>('PROFIT');
  const date = new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeZone: 'Africa/Nouakchott'});
  const performanceMetrics = ['revenue', 'costOfGoods', 'grossProfit', 'expenses', 'netProfit'] as const;
  const positionMetrics = ['inventoryValue', 'supplierDebt', 'supplierAdvances'] as const;
  const movementForm = <form action={action} className="entry-form capital-movement-form"><input type="hidden" name="locale" value={locale} /><label><span>{t('type')}</span><select name="type" value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="ADDITION">{t('addition')}</option><option value="WITHDRAWAL">{t('withdrawal')}</option></select></label>{type === 'WITHDRAWAL' ? <fieldset className="withdrawal-source"><legend>{t('withdrawalSource')}</legend><label><input type="radio" name="source" value="PROFIT" checked={source === 'PROFIT'} onChange={() => setSource('PROFIT')} /><span>{t('fromProfit')}<small>{money(summary.withdrawableProfit)}</small></span></label><label><input type="radio" name="source" value="CAPITAL" checked={source === 'CAPITAL'} onChange={() => setSource('CAPITAL')} /><span>{t('fromCapital')}<small>{money(summary.capital)}</small></span></label></fieldset> : null}<label><span>{t('amount')}</span><input aria-label={t('amount')} name="amount" inputMode="decimal" required /></label><label><span>{t('date')}</span><input name="occurredAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label><label><span>{t('note')}</span><input name="note" /></label>{state && !state.ok && state.code === 'CAPITAL_CONFIRMATION_REQUIRED' ? <label className="capital-fallback"><input type="checkbox" name="allowCapitalFallback" value="true" required /><span>{t('capitalFallbackConfirm')}</span></label> : null}<div className="entry-footer"><button className="primary-action" disabled={pending}>{t('record')}</button>{state && !state.ok ? <p className="form-error">{t(`errors.${state.code}`)}</p> : null}{state?.ok ? <p className="form-success">{t('saved')}</p> : null}</div></form>;
  return <div className="accounts-workspace">
    <section className="finance-hero"><div><span>{t('cash')}</span><strong dir="ltr">{money(summary.cash)}</strong><p>{t('cashHint')}</p></div>{canManage ? <ActionDialog title={t('newMovement')} trigger={<><Plus size={18} />{t('newMovement')}</>} triggerClass="hero-action">{movementForm}</ActionDialog> : null}</section>
    <section className="finance-separation"><article><span>{t('capital')}</span><strong data-testid="capital-balance" dir="ltr">{money(summary.capital)}</strong><small>{t('capitalHint')}</small></article><article className="is-profit"><span>{t('availableProfit')}</span><strong dir="ltr">{money(summary.withdrawableProfit)}</strong><small>{t('profitHint')}</small></article></section>
    <section className="accounts-section"><header><div><h2>{t('periodPerformance')}</h2><p>{t('periodPerformanceHint')}</p></div><span>{periodCaption}</span></header><div className="accounts-metrics">{performanceMetrics.map((key) => <article className={key === 'netProfit' ? 'is-profit' : ''} key={key} data-testid={key === 'netProfit' ? 'net-profit' : undefined}><span>{t(key)}</span><strong dir="ltr">{money(summary[key])}</strong></article>)}</div></section>
    <section className="accounts-section"><header><div><h2>{t('currentPosition')}</h2><p>{t('currentPositionHint')}</p></div><span>{t('now')}</span></header><div className="accounts-metrics accounts-position">{positionMetrics.map((key) => <article key={key}><span>{t(key)}</span><strong dir="ltr">{money(summary[key])}</strong></article>)}</div></section>
    <section className="ledger-panel"><header className="ledger-heading"><h2>{t('history')}</h2><span>{periodCaption}</span></header><div className="capital-history">{movements.map((movement) => <article key={movement.id}><span className={movement.type === 'ADDITION' ? 'movement-icon is-in' : 'movement-icon is-out'}>{movement.type === 'ADDITION' ? '+' : '−'}</span><div><strong>{t(movement.type === 'ADDITION' ? 'addition' : 'withdrawal')}</strong><small>{movement.note || movement.operatorName} · {date.format(new Date(movement.occurredAt))}</small>{movement.type === 'WITHDRAWAL' ? <small>{Number(movement.profitPortion) > 0 ? t('profitPortion', {amount: money(movement.profitPortion)}) : ''}{Number(movement.capitalPortion) > 0 ? ` · ${t('capitalPortion', {amount: money(movement.capitalPortion)})}` : ''}</small> : null}</div><b dir="ltr">{money(movement.amount)}</b></article>)}{!movements.length ? <p className="catalog-empty">{t('emptyPeriod')}</p> : null}</div></section>
  </div>;
}
