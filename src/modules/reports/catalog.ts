// Shared by the server pages, the print view and the CSV export, so it must stay free of server-only imports.
export const REPORT_GROUPS = ['sales', 'expenses', 'stock', 'team'] as const;
export type ReportGroup = (typeof REPORT_GROUPS)[number];

export type ReportFilterKey = 'period' | 'employee' | 'saleStatus' | 'category' | 'movementType' | 'stockLevel';

export type ReportDefinition = {
  slug: string;
  group: ReportGroup;
  // "own" reports are also offered to employees limited to their own activity.
  scope: 'own' | 'all';
  filters: readonly ReportFilterKey[];
};

export const REPORTS = [
  {slug: 'financial-summary', group: 'sales', scope: 'own', filters: ['period', 'employee']},
  {slug: 'sales-journal', group: 'sales', scope: 'own', filters: ['period', 'employee', 'saleStatus']},
  {slug: 'sales-by-medicine', group: 'sales', scope: 'own', filters: ['period', 'employee']},
  {slug: 'sales-by-employee', group: 'sales', scope: 'all', filters: ['period']},
  {slug: 'expenses-journal', group: 'expenses', scope: 'own', filters: ['period', 'employee', 'category']},
  {slug: 'stock-valuation', group: 'stock', scope: 'all', filters: ['stockLevel']},
  {slug: 'stock-alerts', group: 'stock', scope: 'all', filters: []},
  {slug: 'stock-receipts', group: 'stock', scope: 'all', filters: ['period', 'employee']},
  {slug: 'stock-movements', group: 'stock', scope: 'all', filters: ['period', 'employee', 'movementType']},
  {slug: 'dormant-stock', group: 'stock', scope: 'all', filters: ['period']},
  {slug: 'shifts', group: 'team', scope: 'own', filters: ['period', 'employee']},
  {slug: 'cancellations', group: 'team', scope: 'all', filters: ['period', 'employee']}
] as const satisfies readonly ReportDefinition[];

export type ReportSlug = (typeof REPORTS)[number]['slug'];

export const findReport = (slug: string): ReportDefinition | undefined =>
  REPORTS.find((report) => report.slug === slug);

export const reportNumber = (slug: string) =>
  String(REPORTS.findIndex((report) => report.slug === slug) + 1).padStart(2, '0');
