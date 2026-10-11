export const MEDICINE_FILTERS = ['all', 'available', 'low', 'out', 'archived'] as const;
export type MedicineFilter = (typeof MEDICINE_FILTERS)[number];

// Read from ?filter= so the dashboard can link straight to e.g. out-of-stock medicines.
export const parseMedicineFilter = (value: string | undefined): MedicineFilter =>
  MEDICINE_FILTERS.includes(value as MedicineFilter) ? (value as MedicineFilter) : 'all';
