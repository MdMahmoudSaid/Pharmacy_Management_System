import {getTranslations} from 'next-intl/server';

import {auditChanges, type AuditValue} from '../format';

type AuditRow = Awaited<ReturnType<typeof import('../queries').listAuditLogs>>[number];
type ReferenceNames = Awaited<ReturnType<typeof import('../queries').auditReferenceNames>>;

export async function AuditTable({rows, names, locale}: {rows: AuditRow[]; names: ReferenceNames; locale: 'ar' | 'fr'}) {
  const [t, tEmployees] = await Promise.all([getTranslations('Audit'), getTranslations('Employees')]);
  const format = new Intl.DateTimeFormat(locale, {dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Nouakchott'});
  const separator = locale === 'ar' ? '، ' : ', ';
  const dayFormat = new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeZone: 'Africa/Nouakchott'});
  const medicineName = (id: number) => names.medicines[id] ?? t('medicineFallback');

  const renderValue = (value: AuditValue) => {
    switch (value.kind) {
      case 'empty': return t('valueLabels.empty');
      case 'text': return value.text;
      case 'money': return <span dir="ltr">{value.amount} MRU</span>;
      case 'date': return format.format(new Date(value.iso));
      case 'label': return t(`valueLabels.${value.key}` as 'valueLabels.empty');
      case 'medicine': return medicineName(value.id);
      case 'category': return names.categories[value.id] ?? t('entities.expense_categories');
      case 'user': return names.users[value.id] ?? t('userFallback');
      case 'items': return value.items.map((item) => t('item', {medicine: medicineName(item.medicineId), quantity: item.quantity})).join(separator);
      case 'permissions': return value.keys.map((key) => tEmployees(`permissionLabels.${key.replaceAll('.', '_')}` as 'permissionLabels.audit_view_all')).join(separator);
    }
  };

  const entityName = (type: string, id: number): string | undefined => {
    if (type === 'users') return names.users[id];
    if (type === 'medicines') return names.medicines[id];
    if (type === 'expense_categories') return names.categories[id];
    if (type === 'expenses') return names.expenses[id] || undefined;
    if (type === 'sales') return names.sales[id]?.join(separator);
    if (type === 'stock_receipts') {
      const receipt = names.stockReceipts[id];
      return receipt ? t('item', {medicine: receipt.medicine, quantity: receipt.quantity}) : undefined;
    }
    if (type === 'shifts') {
      const shift = names.shifts[id];
      return shift ? `\u2068${shift.user}\u2069 · \u2068${dayFormat.format(shift.openedAt)}\u2069` : undefined;
    }
    return undefined;
  };

  if (!rows.length) return <p className="audit-empty">{t('empty')}</p>;

  return (
    <div className="audit-table">
      {rows.map(({audit, actorName}) => {
        const changes = auditChanges(audit.oldValues, audit.newValues);
        return (
          <details key={audit.id} className="audit-entry">
            <summary>
              <strong>
                {t(`actions.${audit.action}`)} · {t(`entities.${audit.entityType}` as 'entities.users')}{' '}
                {entityName(audit.entityType, audit.entityId) ? <bdi>{entityName(audit.entityType, audit.entityId)}</bdi> : null}
              </strong>
              <span>{t('by')} <bdi>{actorName}</bdi> · <bdi>{format.format(audit.createdAt)}</bdi></span>
            </summary>
            {audit.reason ? <p><b>{t('reason')}:</b> {audit.reason}</p> : null}
            {changes.length ? (
              <dl className="audit-changes">
                {changes.map((change) => (
                  <div key={change.field}>
                    <dt>{t(`fields.${change.field}`)}</dt>
                    <dd>
                      {change.old ? <del>{renderValue(change.old)}</del> : null}
                      {change.old && change.new ? <span aria-hidden="true" className="audit-arrow">{locale === 'ar' ? '←' : '→'}</span> : null}
                      {change.new ? <ins>{renderValue(change.new)}</ins> : null}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : <p className="audit-muted">{t('noDetails')}</p>}
          </details>
        );
      })}
    </div>
  );
}
