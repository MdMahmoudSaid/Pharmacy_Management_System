import {and, eq, ilike, or} from 'drizzle-orm';

import {db} from '@/db/client';
import {medicines} from '@/db/schema';
import {AppError} from '@/lib/errors';
import {appendAudit} from '@/modules/audit/service';
import {sensitiveReasonSchema} from '@/modules/auth/schemas';
import {authorize, type PermissionActor} from '@/modules/permissions/service';
import {
  medicineIdSchema,
  medicineInputSchema,
  updateMedicineSchema
} from './schemas';

export async function createMedicine(
  actor: PermissionActor,
  input: {name: string; code?: string | null; sellingPrice: string}
) {
  authorize(actor, 'medicines.create.all');
  const value = medicineInputSchema.parse(input);
  return db.transaction(async (tx) => {
    const [medicine] = await tx
      .insert(medicines)
      .values({
        name: value.name,
        code: value.code || null,
        sellingPrice: value.sellingPrice,
        createdBy: actor.id,
        updatedBy: actor.id
      })
      .returning();
    await appendAudit(tx, {
      actorId: actor.id,
      entityType: 'medicines',
      entityId: medicine.id,
      action: 'CREATE',
      newValues: {
        name: medicine.name,
        code: medicine.code,
        sellingPrice: medicine.sellingPrice
      }
    });
    return medicine;
  });
}

export async function updateMedicine(
  actor: PermissionActor,
  input: {
    id: number;
    name: string;
    code?: string | null;
    sellingPrice: string;
    reason?: string;
  }
) {
  authorize(actor, 'medicines.update.all');
  const value = updateMedicineSchema.parse(input);
  const [current] = await db
    .select()
    .from(medicines)
    .where(eq(medicines.id, value.id))
    .limit(1);
  if (!current) throw new AppError('NOT_FOUND');
  const priceChanged = current.sellingPrice !== value.sellingPrice;
  const reason = priceChanged ? sensitiveReasonSchema.parse(value.reason) : undefined;

  return db.transaction(async (tx) => {
    const [medicine] = await tx
      .update(medicines)
      .set({
        name: value.name,
        code: value.code || null,
        sellingPrice: value.sellingPrice,
        updatedBy: actor.id,
        updatedAt: new Date()
      })
      .where(eq(medicines.id, value.id))
      .returning();
    await appendAudit(tx, {
      actorId: actor.id,
      entityType: 'medicines',
      entityId: medicine.id,
      action: priceChanged ? 'PRICE_OVERRIDE' : 'UPDATE',
      oldValues: {
        name: current.name,
        code: current.code,
        sellingPrice: current.sellingPrice
      },
      newValues: {
        name: medicine.name,
        code: medicine.code,
        sellingPrice: medicine.sellingPrice
      },
      reason
    });
    return medicine;
  });
}

async function setMedicineActive(
  actor: PermissionActor,
  medicineId: number,
  isActive: boolean,
  reason: string
) {
  authorize(
    actor,
    isActive ? 'medicines.restore.all' : 'medicines.archive.all'
  );
  medicineIdSchema.parse(medicineId);
  const cleanReason = sensitiveReasonSchema.parse(reason);
  const [current] = await db
    .select({id: medicines.id, isActive: medicines.isActive})
    .from(medicines)
    .where(eq(medicines.id, medicineId));
  if (!current) throw new AppError('NOT_FOUND');
  await db.transaction(async (tx) => {
    await tx
      .update(medicines)
      .set({isActive, updatedBy: actor.id, updatedAt: new Date()})
      .where(eq(medicines.id, medicineId));
    await appendAudit(tx, {
      actorId: actor.id,
      entityType: 'medicines',
      entityId: medicineId,
      action: isActive ? 'RESTORE' : 'ARCHIVE',
      oldValues: {isActive: current.isActive},
      newValues: {isActive},
      reason: cleanReason
    });
  });
}

export const archiveMedicine = (
  actor: PermissionActor,
  medicineId: number,
  reason: string
) => setMedicineActive(actor, medicineId, false, reason);

export const restoreMedicine = (
  actor: PermissionActor,
  medicineId: number,
  reason: string
) => setMedicineActive(actor, medicineId, true, reason);

export async function searchMedicines(search = '') {
  const term = search.trim();
  const filter = term
    ? and(
        eq(medicines.isActive, true),
        or(ilike(medicines.name, `%${term}%`), ilike(medicines.code, `%${term}%`))
      )
    : eq(medicines.isActive, true);
  return db.select().from(medicines).where(filter).orderBy(medicines.name);
}
