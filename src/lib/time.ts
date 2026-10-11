export const APP_TIME_ZONE = 'Africa/Nouakchott' as const;

export type ReportPreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'this_year';

const startOfUtcDay = (date: Date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );

const addUtcDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

export function nouakchottRange(
  preset: ReportPreset,
  now = new Date()
): {from: Date; to: Date} {
  const today = startOfUtcDay(now);

  if (preset === 'today') {
    return {from: today, to: addUtcDays(today, 1)};
  }

  if (preset === 'yesterday') {
    return {from: addUtcDays(today, -1), to: today};
  }

  if (preset === 'this_week') {
    const mondayOffset = (today.getUTCDay() + 6) % 7;
    const from = addUtcDays(today, -mondayOffset);
    return {from, to: addUtcDays(from, 7)};
  }

  if (preset === 'last_month') {
    return {
      from: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)),
      to: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
    };
  }

  if (preset === 'this_year') {
    return {
      from: new Date(Date.UTC(today.getUTCFullYear(), 0, 1)),
      to: new Date(Date.UTC(today.getUTCFullYear() + 1, 0, 1))
    };
  }

  const from = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
  );
  const to = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1)
  );
  return {from, to};
}
