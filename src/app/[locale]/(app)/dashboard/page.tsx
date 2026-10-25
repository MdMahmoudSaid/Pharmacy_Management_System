import {LogOut, PackagePlus, ReceiptText, ShoppingCart} from 'lucide-react';
import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import Link from 'next/link';
import {notFound} from 'next/navigation';

import {routing} from '@/i18n/routing';
import {logoutAction} from '@/modules/auth/actions';
import {requireSession} from '@/modules/auth/session';
import {DashboardView} from '@/modules/dashboard/components/dashboard-view';
import {parseDashboardPeriod} from '@/modules/dashboard/period';
import {getDashboardSummary, getUserName} from '@/modules/dashboard/queries';
import {can} from '@/modules/permissions/service';
import {getAccountsOverview} from '@/modules/accounts/queries';

const text = (value: string | string[] | undefined) => typeof value === 'string' ? value : undefined;

export default async function DashboardPage({
  params,
  searchParams
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [actor, t, query] = await Promise.all([
    requireSession(),
    getTranslations('Dashboard'),
    searchParams
  ]);
  const period = parseDashboardPeriod({period: text(query.period), from: text(query.from), to: text(query.to)});
  const [dashboard, userName, accounts] = await Promise.all([
    can(actor, 'reports.view.own', actor.id) ? getDashboardSummary(actor, period.range) : null,
    getUserName(actor.id),
    can(actor, 'accounts.view.all') ? getAccountsOverview(actor, period.range) : null
  ]);
  const shortcuts = [
    {key: 'newSale', href: `/${locale}/sales`, icon: ShoppingCart, allowed: can(actor, 'sales.create.own', actor.id)},
    {key: 'newExpense', href: `/${locale}/expenses`, icon: ReceiptText, allowed: can(actor, 'expenses.create.own', actor.id)},
    {key: 'newMedicine', href: `/${locale}/medicines`, icon: PackagePlus, allowed: can(actor, 'medicines.create.all')}
  ] as const;
  const visibleShortcuts = shortcuts.filter(({allowed}) => allowed);
  const shortcutNav = visibleShortcuts.length ? (
    <nav className="dashboard-shortcuts" aria-label={t('shortcuts')}>
      {visibleShortcuts.map(({key, href, icon: Icon}) => (
        <Link key={key} href={href}>
          <span className="shortcut-icon"><Icon size={22} aria-hidden="true" /></span>
          <span><strong>{t(key)}</strong><small>{t(`${key}Hint`)}</small></span>
        </Link>
      ))}
    </nav>
  ) : null;

  return (
    <main className="page-content dashboard-page">
      <div className="dashboard-top">
        <header className="page-heading">
          <p>{t(`summary_${period.preset}`)}</p>
          <h1>{t('welcome')}</h1>
          <span>{t('signedIn', {name: userName})}</span>
        </header>
        <form action={logoutAction} className="dashboard-logout">
          <input type="hidden" name="locale" value={locale} />
          <button className="secondary-action"><LogOut size={18} aria-hidden="true" />{t('logout')}</button>
        </form>
      </div>
      {dashboard ? <DashboardView data={dashboard} finance={accounts?.summary} period={period} locale={locale}>{shortcutNav}</DashboardView> : shortcutNav}
    </main>
  );
}
