import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {routing} from '@/i18n/routing';
import {requireSession} from '@/modules/auth/session';
import {authorize} from '@/modules/permissions/service';
import {SettingsForm} from '@/modules/settings/components/settings-form';
import {getSettings} from '@/modules/settings/queries';

export default async function SettingsPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;if (!hasLocale(routing.locales, locale)) notFound();setRequestLocale(locale);
  const actor = await requireSession();authorize(actor, 'settings.manage.all');
  const [t, settings] = await Promise.all([getTranslations('Settings'), getSettings()]);
  return <main className="page-content"><header className="page-heading"><p>{t('kicker')}</p><h1>{t('title')}</h1><span>{t('subtitle')}</span></header><div className="settings-layout"><SettingsForm settings={settings} locale={locale} /></div></main>;
}
