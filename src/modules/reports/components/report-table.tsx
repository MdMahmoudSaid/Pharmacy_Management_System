import type {ReactNode} from 'react';

export type ReportColumn = {label: string; numeric?: boolean};

// On phones each row becomes a card; data-label lets CSS repeat the column name next to each value.
export function ReportTable({
  columns,
  rows,
  emptyText
}: {
  columns: ReportColumn[];
  rows: ReactNode[][];
  emptyText: string;
}) {
  if (!rows.length) return <p className="catalog-empty">{emptyText}</p>;
  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <thead>
          <tr>{columns.map(({label, numeric}) => <th key={label} className={numeric ? 'is-numeric' : undefined}>{label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  data-label={columns[cellIndex].label}
                  className={columns[cellIndex].numeric ? 'is-numeric' : undefined}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
