export function ReportTable({
  headings,
  rows
}: {
  headings: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <thead><tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
