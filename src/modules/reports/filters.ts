import {nouakchottRange, type ReportPreset} from '@/lib/time';
import {reportPresetSchema} from './schemas';

type SearchParams = Record<string, string | string[] | undefined>;

export type ReportFilters = {
  preset: ReportPreset | 'custom';
  from: string;
  to: string;
  range: {from: Date; to: Date};
  employeeId?: number;
  saleStatus?: 'COMPLETED' | 'CANCELLED';
  categoryId?: number | 'none';
  movementType?: string;
  stockLevel?: 'low' | 'out' | 'available';
};

const text = (value: string | string[] | undefined) => (typeof value === 'string' ? value.trim() : '');
const isoDay = /^\d{4}-\d{2}-\d{2}$/;
const positiveId = (value: string) => (/^\d+$/.test(value) && Number(value) > 0 ? Number(value) : undefined);
const dayString = (date: Date) => date.toISOString().slice(0, 10);

export function parseReportFilters(query: SearchParams, now = new Date()): ReportFilters {
  const from = text(query.from);
  const to = text(query.to);
  let preset: ReportFilters['preset'];
  let range: {from: Date; to: Date};
  const requested = text(query.preset);
  // Dates only apply to a custom period, so switching back to a preset is never overridden by stale dates.
  if ((requested === 'custom' || !requested) && isoDay.test(from) && isoDay.test(to) && from <= to) {
    preset = 'custom';
    // The end date is inclusive for the user, so the query stops at the start of the following day.
    range = {from: new Date(`${from}T00:00:00.000Z`), to: new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000)};
  } else {
    const parsed = reportPresetSchema.safeParse(requested || 'this_month');
    preset = parsed.success ? parsed.data : 'this_month';
    range = nouakchottRange(preset, now);
  }
  const category = text(query.category);
  const saleStatus = text(query.status);
  const stockLevel = text(query.level);
  return {
    preset,
    from: dayString(range.from),
    to: dayString(new Date(range.to.getTime() - 1)),
    range,
    employeeId: positiveId(text(query.employee)),
    saleStatus: saleStatus === 'COMPLETED' || saleStatus === 'CANCELLED' ? saleStatus : undefined,
    categoryId: category === 'none' ? 'none' : positiveId(category),
    movementType: text(query.type) || undefined,
    stockLevel: stockLevel === 'low' || stockLevel === 'out' || stockLevel === 'available' ? stockLevel : undefined
  };
}
