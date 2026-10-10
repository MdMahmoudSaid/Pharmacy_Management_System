import {eq} from 'drizzle-orm';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

import {db} from '@/db/client';
import {migrateDatabase} from '@/db/migrate';
import {auditLogs, medicines, saleItems, sales, stockMovements, stockReceipts} from '@/db/schema';
import type {PermissionActor} from '@/modules/permissions/service';
import {
  archiveMedicine,
  createMedicine,
  restoreMedicine,
  searchMedicines,
  updateMedicine
} from '@/modules/medicines/service';
import {
  correctStockReceipt,
  getMedicineMovements,
  receiveStock
} from '@/modules/stock/service';
import {createShift, createUser, resetDatabase} from '../../factories/database';

describe('medicine catalog and immutable stock ledger', () => {
  let admin: PermissionActor;
  let shiftId: number;

  beforeAll(migrateDatabase);
  beforeEach(async () => {
    await resetDatabase();
    const user = await createUser({role: 'ADMIN'});
    admin = {id: user.id, role: 'ADMIN', isActive: true, permissions: []};
    shiftId = (await createShift({userId: user.id})).id;
  });

  it('creates a medicine and receives 20 units with linked before/after movement', async () => {
    const medicine = await createMedicine(admin, {
      name: 'Paracétamol',
      code: 'PARA-1',
      sellingPrice: '25.50'
    });
    const receipt = await receiveStock(admin, {
      medicineId: medicine.id,
      quantity: 20,
      note: 'Livraison initiale'
    });

    const [stored] = await db.select().from(medicines).where(eq(medicines.id, medicine.id));
    const [movement] = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.relatedEntityId, receipt.id));
    expect(stored.currentStock).toBe(20);
    expect(receipt.shiftId).toBe(shiftId);
    expect(movement).toMatchObject({
      medicineId: medicine.id,
      quantityBefore: 0,
      quantityChange: 20,
      quantityAfter: 20,
      shiftId,
      actorId: admin.id,
      type: 'STOCK_RECEIVED'
    });
  });

  it.each([0, -1, 1.5])('rejects invalid receipt quantity %s', async (quantity) => {
    const medicine = await createMedicine(admin, {
      name: 'Invalid Quantity',
      sellingPrice: '10.00'
    });
    await expect(receiveStock(admin, {medicineId: medicine.id, quantity})).rejects.toBeDefined();
  });

  it('corrects a wrong quantity by the difference without rewriting movements', async () => {
    const medicine = await createMedicine(admin, {name: 'Amoxicilline', sellingPrice: '40.00'});
    const receipt = await receiveStock(admin, {medicineId: medicine.id, quantity: 20});

    await correctStockReceipt(admin, {
      receiptId: receipt.id,
      medicineId: medicine.id,
      quantity: 15,
      reason: 'Quantité saisie incorrectement'
    });

    const [stored] = await db.select().from(medicines).where(eq(medicines.id, medicine.id));
    const movements = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.relatedEntityId, receipt.id));
    expect(stored.currentStock).toBe(15);
    expect(movements.map(({quantityChange}) => quantityChange)).toEqual([20, -5]);
  });

  it('corrects a wrong medicine across two locked stocks', async () => {
    const first = await createMedicine(admin, {name: 'Premier', sellingPrice: '10.00'});
    const second = await createMedicine(admin, {name: 'Deuxième', sellingPrice: '20.00'});
    const receipt = await receiveStock(admin, {medicineId: first.id, quantity: 8});

    await correctStockReceipt(admin, {
      receiptId: receipt.id,
      medicineId: second.id,
      quantity: 8,
      reason: 'Mauvais médicament sélectionné'
    });

    const stocks = await db.select().from(medicines);
    const corrected = await db
      .select()
      .from(stockReceipts)
      .where(eq(stockReceipts.id, receipt.id));
    expect(stocks.map(({currentStock}) => currentStock)).toEqual([0, 8]);
    expect(corrected[0].medicineId).toBe(second.id);
  });

  it('archives from new operations while retaining history, then restores', async () => {
    const medicine = await createMedicine(admin, {name: 'Historique', sellingPrice: '15.00'});
    await receiveStock(admin, {medicineId: medicine.id, quantity: 4});

    await archiveMedicine(admin, medicine.id, 'Produit retiré');

    await expect(searchMedicines('Historique')).resolves.toEqual([]);
    await expect(receiveStock(admin, {medicineId: medicine.id, quantity: 1})).rejects.toMatchObject({
      code: 'CONFLICT'
    });
    await expect(getMedicineMovements({medicineId: medicine.id})).resolves.toHaveLength(1);
    await restoreMedicine(admin, medicine.id, 'Produit remis en vente');
    await expect(searchMedicines('Historique')).resolves.toHaveLength(1);
  });

  it('changes current price with a reason without rewriting historical sale prices', async () => {
    const medicine = await createMedicine(admin, {name: 'Prix historique', sellingPrice: '10.00'});
    const [sale] = await db
      .insert(sales)
      .values({
        saleNumber: 'PRICE-1',
        shiftId,
        operatorId: admin.id,
        total: '10.00',
        idempotencyKey: 'price-history'
      })
      .returning();
    await db.insert(saleItems).values({
      saleId: sale.id,
      medicineId: medicine.id,
      quantity: 1,
      unitPrice: '10.00',
      lineTotal: '10.00'
    });

    await expect(
      updateMedicine(admin, {...medicine, sellingPrice: '12.00', reason: ''})
    ).rejects.toBeDefined();
    await updateMedicine(admin, {
      id: medicine.id,
      name: medicine.name,
      code: medicine.code,
      sellingPrice: '12.00',
      reason: 'Nouveau tarif fournisseur'
    });

    const [item] = await db.select().from(saleItems).where(eq(saleItems.saleId, sale.id));
    const audits = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, 'PRICE_OVERRIDE'));
    expect(item.unitPrice).toBe('10.00');
    expect(audits[0].reason).toBe('Nouveau tarif fournisseur');
  });

  it.each(['archive', 'restore', 'correction'] as const)(
    'requires a reason for sensitive %s',
    async (operation) => {
      const medicine = await createMedicine(admin, {name: 'Motif', sellingPrice: '10.00'});
      const receipt = await receiveStock(admin, {medicineId: medicine.id, quantity: 2});
      const call = {
        archive: () => archiveMedicine(admin, medicine.id, ''),
        restore: () => restoreMedicine(admin, medicine.id, '  '),
        correction: () =>
          correctStockReceipt(admin, {
            receiptId: receipt.id,
            medicineId: medicine.id,
            quantity: 1,
            reason: ''
          })
      }[operation];
      await expect(call()).rejects.toBeDefined();
    }
  );
});
