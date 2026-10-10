import {getTranslations} from 'next-intl/server';

import {Link} from '@/i18n/navigation';

export default async function HomePage() {
  const t = await getTranslations('Common');

  return (
    <main className="welcome-shell">
      <section className="welcome-card" aria-labelledby="welcome-title">
        <div className="brand-mark" aria-hidden="true">+</div>
        <div>
          <h1 id="welcome-title">{t('appName')}</h1>
          <p>{t('tagline')}</p>
        </div>
        <Link className="primary-action" href="/login">
          {t('start')}
        </Link>
      </section>
    </main>
  );
}
