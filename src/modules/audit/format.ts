export const AUDIT_FIELDS = [
  'name',
  'phoneE164',
  'role',
  'isActive',
  'pinReset',
  'code',
  'sellingPrice',
  'minStock',
  'medicineId',
  'categoryId',
  'quantity',
  'total',
  'itemCount',
  'items',
  'status',
  'amount',
  'description',
  'userId',
  'openedAt',
  'closedAt',
  'pharmacyName',
  'defaultLocale',
  'preferredLocale'
] as const;

export type AuditField = (typeof AUDIT_FIELDS)[number] | 'permissionsAdded' | 'permissionsRemoved';

export type AuditValue =
  | {kind: 'empty'}
  | {kind: 'text'; text: string}
  | {kind: 'money'; amount: string}
  | {kind: 'date'; iso: string}
  | {kind: 'label'; key: string}
  | {kind: 'medicine'; id: number}
  | {kind: 'category'; id: number}
  | {kind: 'user'; id: number}
  | {kind: 'items'; items: Array<{medicineId: number; quantity: number}>}
  | {kind: 'permissions'; keys: string[]};

export type AuditChange = {field: AuditField; old?: AuditValue; new?: AuditValue};

const moneyFields = new Set(['sellingPrice', 'total', 'amount']);
const labelFields = new Set(['role', 'status', 'defaultLocale', 'preferredLocale']);

type Values = Record<string, unknown>;

const asRecord = (value: unknown): Values =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Values) : {};

export function auditValue(field: string, value: unknown): AuditValue {
  if (value === null || value === undefined || value === '') return {kind: 'empty'};
  if (field === 'isActive') return {kind: 'label', key: value ? 'active' : 'archived'};
  if (field === 'pinReset') return {kind: 'label', key: 'pinReset'};
  if (field === 'medicineId') return {kind: 'medicine', id: Number(value)};
  if (field === 'categoryId') return {kind: 'category', id: Number(value)};
  if (field === 'userId') return {kind: 'user', id: Number(value)};
  if (field === 'openedAt' || field === 'closedAt') return {kind: 'date', iso: String(value)};
  if (moneyFields.has(field)) return {kind: 'money', amount: String(value)};
  if (labelFields.has(field)) return {kind: 'label', key: String(value)};
  if (field === 'items' && Array.isArray(value)) {
    return {
      kind: 'items',
      items: value.map((item) => {
        const record = asRecord(item);
        return {medicineId: Number(record.medicineId), quantity: Number(record.quantity)};
      })
    };
  }
  return {kind: 'text', text: String(value)};
}

const permissionList = (value: unknown) =>
  Array.isArray(value) ? value.map(String) : [];

export function auditChanges(oldValues: unknown, newValues: unknown): AuditChange[] {
  const before = asRecord(oldValues);
  const after = asRecord(newValues);
  const changes: AuditChange[] = [];

  if ('permissions' in before || 'permissions' in after) {
    const oldKeys = permissionList(before.permissions);
    const newKeys = permissionList(after.permissions);
    const added = newKeys.filter((key) => !oldKeys.includes(key));
    const removed = oldKeys.filter((key) => !newKeys.includes(key));
    if (added.length) changes.push({field: 'permissionsAdded', new: {kind: 'permissions', keys: added}});
    if (removed.length) changes.push({field: 'permissionsRemoved', old: {kind: 'permissions', keys: removed}});
  }

  const hasOld = oldValues !== null && oldValues !== undefined;
  for (const field of AUDIT_FIELDS) {
    if (!(field in before) && !(field in after)) continue;
    const inBoth = field in before && field in after;
    if (inBoth && JSON.stringify(before[field]) === JSON.stringify(after[field])) continue;
    if (!hasOld && (after[field] === null || after[field] === '')) continue;
    changes.push({
      field,
      old: hasOld && field in before ? auditValue(field, before[field]) : undefined,
      new: field in after ? auditValue(field, after[field]) : undefined
    });
  }
  return changes;
}

export function referencedIds(values: unknown[]) {
  const medicineIds = new Set<number>();
  const userIds = new Set<number>();
  const categoryIds = new Set<number>();
  for (const value of values) {
    const record = asRecord(value);
    if (record.medicineId !== undefined) medicineIds.add(Number(record.medicineId));
    if (record.userId !== undefined) userIds.add(Number(record.userId));
    if (record.categoryId !== undefined && record.categoryId !== null) categoryIds.add(Number(record.categoryId));
    if (Array.isArray(record.items)) {
      for (const item of record.items) {
        const medicineId = asRecord(item).medicineId;
        if (medicineId !== undefined) medicineIds.add(Number(medicineId));
      }
    }
  }
  return {medicineIds: [...medicineIds], userIds: [...userIds], categoryIds: [...categoryIds]};
}
