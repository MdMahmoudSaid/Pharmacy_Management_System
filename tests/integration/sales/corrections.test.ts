import {and, eq, sql} from 'drizzle-orm';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

import {db} from '@/db/client';
import {migrateDatabase} from '@/db/migrate';
import {
  auditLogs,
  medicines,
  saleItems,
  sales,
  shifts,
  stockMovements
} from '@/db/schema';
import type {PermissionActor} from '@/modules/permissions/service';
import {cancelSale, correctSale, createSale} from '@/modules/sales/service';
import {
  createMedicine,
  createShift,
  createUser,
  resetDatabase
} from '../../factories/database';

describe('sale correction and cancellation', () => {
  let owner: PermissionActor;
  let shiftId: number;
  let medicineId: number;
  let saleId: number;

  beforeAll(migrateDatabase);
  beforeEach(async () => {
    await resetDatabase();
    const user = await createUser();
    owner = {
      id: user.id,
      role: 'EMPLOYEE',
      isActive: true,
      permissions: [
        'sales.create.own',
        'sales.correct.own',
        'sales.cancel.own',
        'sales.view.own'
      ]
    };
    shiftId = (await createShift({userId: user.id})).id;
    medicineId = (await createMedicine({currentStock: 20, sellingPrice: '25.50'})).id;
    saleId = (
      await createSale(owner, {
        shiftId,
        idempotencyKey: 'sale-to-change',
        items: [{medicineId, quantity: 3}]
      })
    ).id;
  });

  it('corrects a closed-shift sale with compensating stock and an audit reason', async () => {
    await db
      .update(shifts)
      .set({status: 'CLOSED', closedAt: new Date()})
      .where(eq(shifts.id, shiftId));

    const corrected = await correctSale(
      owner,
      saleId,
      [{medicineId, quantity: 2}],
      'Quantité saisie par erreur'
    );

    const [medicine] = await db
      .select({stock: medicines.currentStock})
      .from(medicines)
      .where(eq(medicines.id, medicineId));
    const movements = await db
      .select()
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.relatedEntityId, saleId),
          eq(stockMovements.type, 'SALE_CORRECTION')
        )
      );
    const [audit] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, saleId), eq(auditLogs.action, 'CORRECT')));

    expect(corrected.total).toBe('51.00');
    expect(medicine.stock).toBe(18);
    expect(movements).toHaveLength(2);
    expect(movements.map(({quantityChange}) => quantityChange)).toEqual([3, -2]);
    expect(audit.reason).toBe('Quantité saisie par erreur');
    expect(audit.oldValues).toMatchObject({total: '76.50'});
    expect(audit.newValues).toMatchObject({total: '51.00'});
  });

  it('cancels once, restores stock, and excludes the sale from active totals', async () => {
    const cancelled = await cancelSale(owner, saleId, 'Vente créée en double');
    const [medicine] = await db
      .select({stock: medicines.currentStock})
      .from(medicines)
      .where(eq(medicines.id, medicineId));
    const [activeTotal] = await db
      .select({total: sql<string>`coalesce(sum(${sales.total}), 0)`})
      .from(sales)
      .where(eq(sales.status, 'COMPLETED'));
    const items = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
    const [audit] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, saleId), eq(auditLogs.action, 'CANCEL')));

    expect(cancelled.status).toBe('CANCELLED');
    expect(medicine.stock).toBe(20);
    expect(activeTotal.total).toBe('0');
    expect(items).toHaveLength(1);
    expect(audit.reason).toBe('Vente créée en double');
    await expect(cancelSale(owner, saleId, 'Autre motif')).rejects.toMatchObject({
      code: 'CONFLICT'
    });
  });

  it('returns the same cancelled sale for the same completed command replay', async () => {
    const first = await cancelSale(owner, saleId, 'Même commande');
    const replay = await cancelSale(owner, saleId, 'Même commande');
    const cancellationMovements = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.type, 'SALE_CANCELLATION'));
    expect(replay.id).toBe(first.id);
    expect(cancellationMovements).toHaveLength(1);
  });

  it('enforces own/all scope', async () => {
    const outsiderUser = await createUser();
    const outsider: PermissionActor = {
      id: outsiderUser.id,
      role: 'EMPLOYEE',
      isActive: true,
      permissions: ['sales.correct.own', 'sales.cancel.own']
    };
    await expect(
      correctSale(outsider, saleId, [{medicineId, quantity: 2}], 'Interdit')
    ).rejects.toMatchObject({code: 'FORBIDDEN'});
    await expect(cancelSale(outsider, saleId, 'Interdit')).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });

    const manager = {
      ...outsider,
      permissions: ['sales.correct.all', 'sales.cancel.all'] as const
    };
    await expect(
      correctSale(manager, saleId, [{medicineId, quantity: 2}], 'Correction autorisée')
    ).resolves.toMatchObject({total: '51.00'});
  });

  it.each([
    {name: 'missing reason', items: [{medicineId: 1, quantity: 2}], reason: ''},
    {name: 'missing medicine', items: [{medicineId: 999_999, quantity: 2}], reason: 'Erreur'},
    {name: 'empty replacement', items: [], reason: 'Erreur'}
  ])('rejects $name without changing the original sale', async ({items, reason}) => {
    await expect(correctSale(owner, saleId, items, reason)).rejects.toBeDefined();
    const [sale] = await db.select().from(sales).where(eq(sales.id, saleId));
    const [medicine] = await db
      .select({stock: medicines.currentStock})
      .from(medicines)
      .where(eq(medicines.id, medicineId));
    expect(sale.total).toBe('76.50');
    expect(medicine.stock).toBe(17);
  });

  it('rolls back a replacement that exceeds available stock', async () => {
    await expect(
      correctSale(
        owner,
        saleId,
        [{medicineId, quantity: 21}],
        'Quantité de remplacement'
      )
    ).rejects.toMatchObject({code: 'INSUFFICIENT_STOCK'});
    const [sale] = await db.select().from(sales).where(eq(sales.id, saleId));
    const [medicine] = await db
      .select({stock: medicines.currentStock})
      .from(medicines)
      .where(eq(medicines.id, medicineId));
    expect(sale.total).toBe('76.50');
    expect(medicine.stock).toBe(17);
  });
});
