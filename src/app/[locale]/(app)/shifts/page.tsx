import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {routing} from '@/i18n/routing';
import {requireSession} from '@/modules/auth/session';
import {can} from '@/modules/permissions/service';
import {ShiftList} from '@/modules/shifts/components/shift-list';
import {ShiftPanel} from '@/modules/shifts/components/shift-panel';
import {listVisibleShifts} from '@/modules/shifts/queries';

export default async function ShiftsPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const actor = await requireSession();
  const [t, rows] = await Promise.all([
    getTranslations('Shifts'),
    listVisibleShifts(actor)
  ]);
  const activeShift = rows.find(
    ({shift}) => shift.userId === actor.id && shift.status === 'OPEN'
  )?.shift;

  return (
    <main className="page-content">
      <header className="page-heading">
        <p>{t('kicker')}</p>
        <h1>{t('title')}</h1>
        <span>{t('subtitle')}</span>
      </header>
      <ShiftPanel locale={locale} activeShift={activeShift} />
      <ShiftList
        rows={rows}
        locale={locale}
        canCorrect={can(actor, 'shifts.correct.all')}
        canReopen={can(actor, 'shifts.reopen.all')}
      />
    </main>
  );
}
