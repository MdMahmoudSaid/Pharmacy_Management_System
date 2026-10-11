'use client';

import {ChevronLeft, ChevronRight} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {useActionState} from 'react';

import {
  correctShiftAction,
  reopenShiftAction,
  type ShiftActionState
} from '../actions';

const localDateTime = (date: Date | null) =>
  date ? date.toISOString().slice(0, 16) : '';

function AdminShiftActions({
  shift,
  locale,
  canCorrect,
  canReopen
}: {
  shift: {id: number; openedAt: Date; closedAt: Date | null; status: 'OPEN' | 'CLOSED'};
  locale: 'ar' | 'fr';
  canCorrect: boolean;
  canReopen: boolean;
}) {
  const t = useTranslations('Shifts');
  const [correctState, correctAction, correcting] = useActionState<
    ShiftActionState,
    FormData
  >(correctShiftAction, undefined);
  const [reopenState, reopenAction, reopening] = useActionState<
    ShiftActionState,
    FormData
  >(reopenShiftAction, undefined);
  return (
    <div className="shift-admin-actions">
      {canCorrect ? (
        <details>
          <summary>{t('correct')}</summary>
          <form action={correctAction}>
            <input type="hidden" name="id" value={shift.id} />
            <input type="hidden" name="locale" value={locale} />
            <input type="datetime-local" name="openedAt" defaultValue={localDateTime(shift.openedAt)} required />
            {shift.status === 'CLOSED' ? (
              <input type="datetime-local" name="closedAt" defaultValue={localDateTime(shift.closedAt)} required />
            ) : null}
            {correctState && !correctState.ok ? <small>{correctState.code}</small> : null}
            {correctState?.ok ? <small data-testid="correction-saved">OK</small> : null}
            <button className="secondary-action" disabled={correcting}>{t('save')}</button>
          </form>
        </details>
      ) : null}
      {canReopen && shift.status === 'CLOSED' ? (
        <form action={reopenAction} className="reopen-form">
          <input type="hidden" name="id" value={shift.id} />
          <input type="hidden" name="locale" value={locale} />
          <input name="reason" placeholder={t('reason')} required />
          {reopenState && !reopenState.ok ? <small>{reopenState.code}</small> : null}
          <button className="secondary-action" disabled={reopening}>{t('reopen')}</button>
        </form>
      ) : null}
    </div>
  );
}

export function ShiftList({
  rows,
  locale,
  canCorrect,
  canReopen
}: {
  rows: Array<{shift: {id: number; openedAt: Date; closedAt: Date | null; status: 'OPEN' | 'CLOSED'}; userName: string}>;
  locale: 'ar' | 'fr';
  canCorrect: boolean;
  canReopen: boolean;
}) {
  const t = useTranslations('Shifts');
  const format = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Nouakchott'
  });
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight;
  return (
    <section className="shift-list">
      <h2>{t('history')}</h2>
      {rows.map(({shift, userName}) => (
        <article key={shift.id} className="shift-row">
          <Link href={`/${locale}/shifts/${shift.id}`} className="shift-row-link">
            <span>
              <strong>{userName}</strong>
              <p><bdi>{format.format(shift.openedAt)}</bdi> — <bdi>{shift.closedAt ? format.format(shift.closedAt) : t('ongoing')}</bdi></p>
            </span>
            <small>{t('viewDetail')}<Chevron size={14} aria-hidden="true" /></small>
          </Link>
          <span className={shift.status === 'OPEN' ? 'status-active' : 'status-archived'}>
            {shift.status === 'OPEN' ? t('openStatus') : t('closedStatus')}
          </span>
          <AdminShiftActions
            shift={shift}
            locale={locale}
            canCorrect={canCorrect}
            canReopen={canReopen}
          />
        </article>
      ))}
    </section>
  );
}
