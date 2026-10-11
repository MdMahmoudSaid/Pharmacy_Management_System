import type {Cell, CellKind, Metric} from './builders';

const TIME_ZONE = 'Africa/Nouakchott';
const amount = new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const count = new Intl.NumberFormat('en-US');
const percent = new Intl.NumberFormat('en-US', {maximumFractionDigits: 1});
// ISO-like dates read the same in Arabic and French and never get reordered by the bidi algorithm.
const day = new Intl.DateTimeFormat('en-CA', {year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TIME_ZONE});
const time = new Intl.DateTimeFormat('en-GB', {hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TIME_ZONE});

export type DurationFormatter = (minutes: number) => string;

export const formatDay = (date: Date) => day.format(date);
export const formatDateTime = (date: Date) => `${day.format(date)} ${time.format(date)}`;

// Plain text used on screen, in the PDF and in the CSV; money keeps its currency apart so it can be styled.
export function formatValue(kind: CellKind | Metric['kind'], value: Cell['value'], duration: DurationFormatter): string {
  if (value === null || value === '') return '—';
  if (value instanceof Date) return kind === 'date' ? formatDay(value) : formatDateTime(value);
  switch (kind) {
    case 'money':
      return amount.format(Number(value));
    case 'number':
      return typeof value === 'number' ? count.format(value) : String(value);
    case 'signed':
      return Number(value) > 0 ? `+${count.format(Number(value))}` : count.format(Number(value));
    case 'percent':
      return `${percent.format(Number(value))} %`;
    case 'duration':
      return duration(Number(value));
    default:
      return String(value);
  }
}

export const isNumericKind = (kind: CellKind) => kind !== 'text' && kind !== 'date' && kind !== 'datetime';
