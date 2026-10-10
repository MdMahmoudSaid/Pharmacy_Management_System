import {
  Boxes,
  Clock3,
  Home,
  Menu,
  ReceiptText,
  UsersRound
} from 'lucide-react';
import {getTranslations} from 'next-intl/server';
import Link from 'next/link';
import type {ReactNode} from 'react';

import type {PermissionActor} from '@/modules/permissions/service';
import {LanguageSwitcher} from './language-switcher';

type NavItem = {
  key: 'home' | 'sales' | 'stock' | 'shift' | 'medicines' | 'employees' | 'more';
  href: string;
  icon: typeof Home;
  domain?: string;
};

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
  const items: NavItem[] = [
    {key: 'home', href: `${base}/dashboard`, icon: Home},
    {
      key: 'sales',
      href: `${base}/sales`,
      icon: ReceiptText,
      domain: 'sales'
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
    {key: 'more', href: `${base}/more`, icon: Menu}
  ];
  const visible = items.filter(
    (item) =>
      !item.domain ||
      actor.role === 'ADMIN' ||
      actor.permissions.some((permission) => permission.startsWith(`${item.domain}.`))
  );

  return (
    <div className="app-frame">
      <aside className="desktop-sidebar">
        <Link className="shell-brand" href={`${base}/dashboard`}>
          <span>+</span>
          <strong>{t('brand')}</strong>
        </Link>
        <nav aria-label={t('main')}>
          {visible.map(({key, href, icon: Icon}) => (
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
          .filter(({key}) =>
            ['home', 'sales', 'stock', 'shift', 'more'].includes(key)
          )
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
