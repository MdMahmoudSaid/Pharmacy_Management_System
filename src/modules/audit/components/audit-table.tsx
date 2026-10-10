import {getTranslations} from 'next-intl/server';

type AuditRow = Awaited<ReturnType<typeof import('../queries').listAuditLogs>>[number];

export async function AuditTable({rows, locale}: {rows: AuditRow[]; locale: 'ar' | 'fr'}) {
  const t = await getTranslations('Audit');
  const format = new Intl.DateTimeFormat(locale, {dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Nouakchott'});
  return (
    <div className="audit-table">
      {rows.map(({audit, actorName}) => (
        <article key={audit.id}>
          <header><strong>{audit.action} · {audit.entityType} #{audit.entityId}</strong><span>{actorName} · {format.format(audit.createdAt)}</span></header>
          {audit.reason ? <p><b>{t('reason')}:</b> {audit.reason}</p> : null}
          <details><summary>{t('values')}</summary><pre>{JSON.stringify({old: audit.oldValues, new: audit.newValues}, null, 2)}</pre></details>
        </article>
      ))}
    </div>
  );
}
