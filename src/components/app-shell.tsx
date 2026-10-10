import {
  Boxes,
  Clock3,
  Home,
  FileBarChart,
  ListChecks,
  Settings,
  Menu,
  ReceiptText,
  WalletCards,
  UsersRound
} from 'lucide-react';
import {getTranslations} from 'next-intl/server';
import Link from 'next/link';
import type {ReactNode} from 'react';

import type {PermissionActor} from '@/modules/permissions/service';
import {LanguageSwitcher} from './language-switcher';

export type NavItem = {
  key: 'home' | 'sales' | 'expenses' | 'stock' | 'shift' | 'medicines' | 'employees' | 'reports' | 'audit' | 'settings' | 'more';
  href: string;
  icon: typeof Home;
  domain?: string;
};

// Pages reachable from the mobile bottom bar; everything else lives on the "more" page.
export const MOBILE_BAR_KEYS: readonly NavItem['key'][] = ['home', 'sales', 'stock', 'shift', 'more'];

export function navItems(actor: PermissionActor, locale: 'ar' | 'fr'): NavItem[] {
  const base = `/${locale}`;
  const items: NavItem[] = [
    {key: 'home', href: `${base}/dashboard`, icon: Home},
    {
      key: 'sales',
      href: `${base}/sales`,
      icon: ReceiptText,
      domain: 'sales'
    },
    {
      key: 'expenses',
      href: `${base}/expenses`,
      icon: WalletCards,
      domain: 'expenses'
    },
    {
      key: 'stock',
      href: `${base}/stock`,
      icon: Boxes,
      domain: 'stock'
    },
    {
      key: 'shift',
      href: `${base}/shifts`,
      icon: Clock3,
      domain: 'shifts'
    },
    {
      key: 'employees',
      href: `${base}/employees`,
      icon: UsersRound,
      domain: 'employees'
    },
    {
      key: 'medicines',
      href: `${base}/medicines`,
      icon: Boxes,
      domain: 'medicines'
    },
    {key: 'reports', href: `${base}/reports`, icon: FileBarChart, domain: 'reports'},
    {key: 'audit', href: `${base}/audit`, icon: ListChecks, domain: 'audit'},
    {key: 'settings', href: `${base}/settings`, icon: Settings, domain: 'settings'},
    {key: 'more', href: `${base}/more`, icon: Menu}
  ];
  return items.filter(
    (item) =>
      !item.domain ||
      actor.role === 'ADMIN' ||
      actor.permissions.some((permission) => permission.startsWith(`${item.domain}.`))
  );
}

export async function AppShell({
  actor,
  locale,
  children
}: {
  actor: PermissionActor;
  locale: 'ar' | 'fr';
  children: ReactNode;
}) {
  const t = await getTranslations('Navigation');
  const base = `/${locale}`;
  const visible = navItems(actor, locale);

  return (
    <div className="app-frame">
      <aside className="desktop-sidebar">
        <Link className="shell-brand" href={`${base}/dashboard`}>
          <span>+</span>
          <strong>{t('brand')}</strong>
        </Link>
        <nav aria-label={t('main')}>
          {visible.filter(({key}) => key !== 'more').map(({key, href, icon: Icon}) => (
            <Link href={href} key={key}>
              <Icon size={20} />
              <span>{t(key)}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <LanguageSwitcher locale={locale} />
        </div>
      </aside>
      <div className="app-content">
        <header className="mobile-header">
          <span className="shell-brand-mark">+</span>
          <LanguageSwitcher locale={locale} />
        </header>
        {children}
      </div>
      <nav className="mobile-bottom-nav" aria-label={t('mobile')}>
        {visible
          .filter(({key}) => MOBILE_BAR_KEYS.includes(key))
          .map(({key, href, icon: Icon}) => (
            <Link href={href} key={key}>
              <Icon size={20} />
              <span>{t(key)}</span>
            </Link>
          ))}
      </nav>
    </div>
  );
}
