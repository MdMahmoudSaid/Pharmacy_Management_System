export const PERMISSION_KEYS = [
  'sales.view.own',
  'sales.view.all',
  'sales.create.own',
  'sales.correct.own',
  'sales.correct.all',
  'sales.cancel.own',
  'sales.cancel.all',
  'sales.print.own',
  'sales.print.all',
  'sales.price_override.all',
  'expenses.view.own',
  'expenses.view.all',
  'expenses.create.own',
  'expenses.correct.own',
  'expenses.correct.all',
  'expenses.cancel.own',
  'expenses.cancel.all',
  'stock.view.all',
  'stock.receive.own',
  'stock.correct.all',
  'stock.adjust.all',
  'suppliers.view.all',
  'suppliers.manage.all',
  'suppliers.pay.all',
  'accounts.view.all',
  'accounts.manage.all',
  'shifts.view.own',
  'shifts.view.all',
  'shifts.open.own',
  'shifts.close.own',
  'shifts.correct.all',
  'shifts.reopen.all',
  'medicines.view.all',
  'medicines.create.all',
  'medicines.update.all',
  'medicines.archive.all',
  'medicines.restore.all',
  'reports.view.own',
  'reports.view.all',
  'reports.print.own',
  'reports.print.all',
  'audit.view.all',
  'employees.view.all',
  'employees.create.all',
  'employees.update.all',
  'employees.archive.all',
  'employees.restore.all',
  'employees.reset_pin.all',
  'permissions.manage.all',
  'settings.manage.all'
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

const permissionKeySet = new Set<string>(PERMISSION_KEYS);

export function isPermissionKey(value: string): value is PermissionKey {
  return permissionKeySet.has(value);
}

// Ready-made sets of permissions offered when an employee account is created.
export const ROLE_PRESETS = {
  shift_employee: [
    'shifts.view.own',
    'shifts.open.own',
    'shifts.close.own',
    'sales.view.own',
    'sales.create.own',
    'sales.print.own',
    'expenses.view.own',
    'expenses.create.own',
    'medicines.view.all',
    'reports.view.own'
  ]
} as const satisfies Record<string, readonly PermissionKey[]>;

export type RolePresetKey = keyof typeof ROLE_PRESETS;
export const ROLE_PRESET_KEYS = Object.keys(ROLE_PRESETS) as RolePresetKey[];
