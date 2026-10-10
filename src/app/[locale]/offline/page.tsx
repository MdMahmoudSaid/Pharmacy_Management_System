import {getTranslations} from 'next-intl/server';
export default async function OfflinePage() {const t = await getTranslations('Offline');return <main className="welcome-shell"><section className="welcome-card"><div className="brand-mark">+</div><h1>{t('title')}</h1><p>{t('text')}</p></section></main>;}
