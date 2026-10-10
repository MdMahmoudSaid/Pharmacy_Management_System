import {getTranslations} from 'next-intl/server';

export async function DashboardView({
  data
}: {
  data: {
    summary: {salesTotal: string; expensesTotal: string; netTotal: string};
    stockUnits: number;
    openShifts: unknown[];
    recentActivity: Array<{id: number; action: string; entityType: string; reason: string | null}>;
  };
}) {
  const t = await getTranslations('Dashboard');
  const cards = [
    [t('todaySales'), `${data.summary.salesTotal} MRU`],
    [t('todayExpenses'), `${data.summary.expensesTotal} MRU`],
    [t('todayNet'), `${data.summary.netTotal} MRU`],
    [t('stockUnits'), String(data.stockUnits)],
    [t('openShifts'), String(data.openShifts.length)]
  ];
  return (
    <>
      <section className="metric-grid">
        {cards.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
      </section>
      <section className="recent-activity">
        <h2>{t('recentActivity')}</h2>
        {data.recentActivity.map((entry) => (
          <article key={entry.id}><strong>{entry.action}</strong><span>{entry.entityType}</span>{entry.reason ? <p>{entry.reason}</p> : null}</article>
        ))}
      </section>
    </>
  );
}
