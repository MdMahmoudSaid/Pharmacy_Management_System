import Link from 'next/link';

import type {Cell, Column, Metric, ReportResult} from '../builders';
import {formatValue, isNumericKind, type DurationFormatter} from '../format';

function Value({kind, value, duration}: {kind: Column['kind'] | Metric['kind']; value: Cell['value']; duration: DurationFormatter}) {
  const text = formatValue(kind, value, duration);
  if (kind === 'money' && value !== null) {
    return <bdi dir="ltr" className="rpt-money">{text} <small>MRU</small></bdi>;
  }
  // Durations contain words ("3 h 05 min"), so they follow the page direction instead of being forced left-to-right.
  if (kind === 'text' || kind === 'duration' || text === '—') return <>{text}</>;
  return <bdi dir="ltr">{text}</bdi>;
}

function TableCell({column, value, locale, duration, header}: {
  column: Column;
  value: Cell | null;
  locale: 'ar' | 'fr';
  duration: DurationFormatter;
  header?: string;
}) {
  const className = [isNumericKind(column.kind) ? 'is-numeric' : '', value?.tone ? `tone-${value.tone}` : ''].filter(Boolean).join(' ') || undefined;
  const content = value ? <Value kind={column.kind} value={value.value} duration={duration} /> : header ?? null;
  return (
    <td className={className} data-label={header ? undefined : column.label}>
      {value?.href ? <Link href={`/${locale}${value.href}`}>{content}</Link> : content}
    </td>
  );
}

export function ReportSummary({result, rowCountLabel, duration}: {result: ReportResult; rowCountLabel: string; duration: DurationFormatter}) {
  return (
    <section className="rpt-summary">
      <div className="rpt-summary-primary">
        <span>{result.primary.label}</span>
        <strong className={result.primary.kind === 'money' && Number(result.primary.value) < 0 ? 'is-negative' : undefined}>
          <Value kind={result.primary.kind} value={result.primary.value} duration={duration} />
        </strong>
      </div>
      <dl className="rpt-summary-metrics">
        {result.metrics.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd><Value kind={item.kind} value={item.value} duration={duration} /></dd>
          </div>
        ))}
      </dl>
      <span className="rpt-row-count">{rowCountLabel}</span>
    </section>
  );
}

export function ReportDataTable({result, locale, duration, emptyText}: {
  result: ReportResult;
  locale: 'ar' | 'fr';
  duration: DurationFormatter;
  emptyText: string;
}) {
  if (!result.rows.length) return <p className="rpt-empty">{emptyText}</p>;
  // The footer label sits in the first empty cell before the first total.
  const labelIndex = result.totals ? Math.max(0, result.totals.findIndex((value) => value !== null) - 1) : -1;
  return (
    <div className="rpt-table-wrap">
      <table className="rpt-table">
        <thead>
          <tr>
            {result.columns.map((column) => (
              <th key={column.key} className={isNumericKind(column.kind) ? 'is-numeric' : undefined} scope="col">{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, index) => (
            // Only a cancelled record (its status column) greys out the row, not a count of cancellations.
            <tr
              key={index}
              className={row.some((value, cellIndex) => value.tone === 'cancelled' && result.columns[cellIndex].kind === 'text') ? 'is-cancelled' : undefined}
            >
              {row.map((value, cellIndex) => (
                <TableCell key={cellIndex} column={result.columns[cellIndex]} value={value} locale={locale} duration={duration} />
              ))}
            </tr>
          ))}
        </tbody>
        {result.totals ? (
          <tfoot>
            <tr>
              {result.totals.map((value, cellIndex) => (
                <TableCell
                  key={cellIndex}
                  column={result.columns[cellIndex]}
                  value={value}
                  locale={locale}
                  duration={duration}
                  header={cellIndex === labelIndex ? result.totalsLabel : undefined}
                />
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
