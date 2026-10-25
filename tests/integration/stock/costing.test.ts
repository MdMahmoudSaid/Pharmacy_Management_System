import {eq} from 'drizzle-orm';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

import {db} from '@/db/client';
import {migrateDatabase} from '@/db/migrate';
import {medicines, saleItems, stockMovements, stockReceipts} from '@/db/schema';
import type {PermissionActor} from '@/modules/permissions/service';
import {correctSale, createSale} from '@/modules/sales/service';
import {adjustStock, getMedicineMovements, receiveStock, receiveStockBatch} from '@/modules/stock/service';
import {createSupplier, setSupplierActive} from '@/modules/suppliers/service';
import {getSupplierDetail} from '@/modules/suppliers/queries';
import {
  createMedicine,
  createShift,
  createUser,
  resetDatabase
} from '../../factories/database';

describe('cost-aware stock ledger', () => {
  let admin: PermissionActor;
  let shiftId: number;

  beforeAll(migrateDatabase);
  beforeEach(async () => {
    await resetDatabase();
    const user = await createUser({role: 'ADMIN'});
    admin = {id: user.id, role: 'ADMIN', isActive: true, permissions: []};
    shiftId = (await createShift({userId: user.id})).id;
  });

  it('atomically creates supplier debt and recalculates weighted average cost', async () => {
    const supplier = await createSupplier(admin, {name: 'Grossiste'});
    const medicine = await createMedicine({sellingPrice: '25.00'});
    await receiveStock(admin, {medicineId: medicine.id, supplierId: supplier.id, quantity: 10, unitCost: '5.00', sellingPrice: '8.00'});
    await receiveStock(admin, {medicineId: medicine.id, supplierId: supplier.id, quantity: 10, unitCost: '15.00', sellingPrice: '12.00'});

    const [stored] = await db.select().from(medicines).where(eq(medicines.id, medicine.id));
    expect(stored).toMatchObject({currentStock: 20, averageCost: '10.00', sellingPrice: '12.00'});
    await expect(getSupplierDetail(admin, supplier.id)).resolves.toMatchObject({
      summary: {purchases: '200.00', payments: '0.00', balance: '200.00'}
    });
    const movements = await getMedicineMovements({medicineId: medicine.id});
    expect(movements[0]).toMatchObject({
      supplierName: 'Grossiste',
      unitCost: '15.00',
      totalCost: '150.00'
    });
  });

  it('receives several medicines in one go from the total paid for each line', async () => {
    const supplier = await createSupplier(admin, {name: 'Multi'});
    const first = await createMedicine({sellingPrice: '10.00'});
    const second = await createMedicine({sellingPrice: '10.00'});
    const receipts = await receiveStockBatch(admin, {
      supplierId: supplier.id,
      note: 'Facture 12',
      lines: [
        // 1000 for 3 units: 333.33 a unit, but the supplier is still owed exactly 1000.
        {medicineId: first.id, quantity: 3, totalCost: '1000.00', sellingPrice: '450.00'},
        {medicineId: second.id, quantity: 4, totalCost: '80.00', sellingPrice: '30.00'}
      ]
    });
    expect(receipts).toHaveLength(2);
    expect(receipts[0]).toMatchObject({unitCost: '333.33', totalCost: '1000.00'});
    const [one] = await db.select().from(medicines).where(eq(medicines.id, first.id));
    expect(one).toMatchObject({currentStock: 3, averageCost: '333.33', sellingPrice: '450.00'});
    const [two] = await db.select().from(medicines).where(eq(medicines.id, second.id));
    expect(two).toMatchObject({currentStock: 4, averageCost: '20.00', sellingPrice: '30.00'});
    await expect(getSupplierDetail(admin, supplier.id)).resolves.toMatchObject({
      summary: {purchases: '1080.00', balance: '1080.00'}
    });
  });

  it('records nothing when one line of the receipt is refused', async () => {
    const supplier = await createSupplier(admin, {name: 'Atomic'});
    const good = await createMedicine();
    const bad = await createMedicine();
    await expect(
      receiveStockBatch(admin, {
        supplierId: supplier.id,
        lines: [
          {medicineId: good.id, quantity: 2, totalCost: '10.00', sellingPrice: '9.00'},
          // Sold at less than it costs: refused.
          {medicineId: bad.id, quantity: 2, totalCost: '100.00', sellingPrice: '20.00'}
        ]
      })
    ).rejects.toMatchObject({code: 'VALIDATION_ERROR'});
    const [stored] = await db.select().from(medicines).where(eq(medicines.id, good.id));
    expect(stored).toMatchObject({currentStock: 0, averageCost: '0.00'});
    await expect(db.select().from(stockReceipts)).resolves.toEqual([]);
  });

  it('refuses the same medicine twice in one receipt', async () => {
    const supplier = await createSupplier(admin, {name: 'Twice'});
    const medicine = await createMedicine();
    await expect(
      receiveStockBatch(admin, {
        supplierId: supplier.id,
        lines: [
          {medicineId: medicine.id, quantity: 1, totalCost: '5.00', sellingPrice: '9.00'},
          {medicineId: medicine.id, quantity: 1, totalCost: '5.00', sellingPrice: '9.00'}
        ]
      })
    ).rejects.toBeDefined();
  });

  it('rolls back every receipt effect when the supplier is archived', async () => {
    const supplier = await createSupplier(admin, {name: 'Archived'});
    const medicine = await createMedicine();
    await setSupplierActive(admin, supplier.id, false);

    await expect(
      receiveStock(admin, {medicineId: medicine.id, supplierId: supplier.id, quantity: 5, unitCost: '3.00', sellingPrice: '4.00'})
    ).rejects.toMatchObject({code: 'CONFLICT'});
    const [stored] = await db.select().from(medicines).where(eq(medicines.id, medicine.id));
    expect(stored).toMatchObject({currentStock: 0, averageCost: '0.00'});
    await expect(db.select().from(stockReceipts)).resolves.toEqual([]);
  });

  it('captures average unit cost on the sale item', async () => {
    const supplier = await createSupplier(admin, {name: 'Sale Cost'});
    const medicine = await createMedicine({sellingPrice: '20.00'});
    await receiveStock(admin, {medicineId: medicine.id, supplierId: supplier.id, quantity: 5, unitCost: '8.00', sellingPrice: '20.00'});
    const sale = await createSale(admin, {
      shiftId,
      idempotencyKey: 'cost-capture',
      items: [{medicineId: medicine.id, quantity: 2}]
    });

    const [item] = await db.select().from(saleItems).where(eq(saleItems.saleId, sale.id));
    expect(item).toMatchObject({quantity: 2, unitPrice: '20.00', unitCost: '8.00'});
  });

  it('preserves the original cost snapshot when correcting a sold medicine later', async () => {
    const supplier = await createSupplier(admin, {name: 'Historical Cost'});
    const medicine = await createMedicine({sellingPrice: '20.00'});
    await receiveStock(admin, {medicineId: medicine.id, supplierId: supplier.id, quantity: 5, unitCost: '8.00', sellingPrice: '20.00'});
    const sale = await createSale(admin, {
      shiftId,
      idempotencyKey: 'historical-cost',
      items: [{medicineId: medicine.id, quantity: 2}]
    });
    await receiveStock(admin, {medicineId: medicine.id, supplierId: supplier.id, quantity: 5, unitCost: '20.00', sellingPrice: '25.00'});

    await correctSale(admin, sale.id, [{medicineId: medicine.id, quantity: 1}], 'Quantity correction');

    const [item] = await db.select().from(saleItems).where(eq(saleItems.saleId, sale.id));
    expect(item.unitCost).toBe('8.00');
  });

  it('posts positive and negative corrections without changing average cost', async () => {
    const supplier = await createSupplier(admin, {name: 'Adjustments'});
    const medicine = await createMedicine();
    await receiveStock(admin, {medicineId: medicine.id, supplierId: supplier.id, quantity: 10, unitCost: '7.50', sellingPrice: '10.00'});
    await adjustStock(admin, {medicineId: medicine.id, quantityChange: 3, reason: 'Unités retrouvées'});
    await adjustStock(admin, {medicineId: medicine.id, quantityChange: -4, reason: 'Casse constatée'});

    const [stored] = await db.select().from(medicines).where(eq(medicines.id, medicine.id));
    expect(stored).toMatchObject({currentStock: 9, averageCost: '7.50'});
    const adjustments = await db.select().from(stockMovements).where(eq(stockMovements.type, 'MANUAL_CORRECTION'));
    expect(adjustments.map(({quantityChange, quantityAfter}) => ({quantityChange, quantityAfter}))).toEqual([
      {quantityChange: 3, quantityAfter: 13},
      {quantityChange: -4, quantityAfter: 9}
    ]);
  });

  it('rejects a selling price that is not above the projected average cost', async () => {
    const supplier = await createSupplier(admin, {name: 'Safe Margin'});
    const medicine = await createMedicine({currentStock: 10, averageCost: '5.00', sellingPrice: '8.00'});

    await expect(receiveStock(admin, {
      medicineId: medicine.id,
      supplierId: supplier.id,
      quantity: 10,
      unitCost: '15.00',
      sellingPrice: '10.00'
    })).rejects.toMatchObject({code: 'VALIDATION_ERROR'});

    const [stored] = await db.select().from(medicines).where(eq(medicines.id, medicine.id));
    expect(stored).toMatchObject({currentStock: 10, averageCost: '5.00', sellingPrice: '8.00'});
    await expect(db.select().from(stockReceipts)).resolves.toEqual([]);
  });

  it('rejects an adjustment below zero and leaves stock unchanged', async () => {
    const medicine = await createMedicine({currentStock: 2, averageCost: '4.00'});
    await expect(
      adjustStock(admin, {medicineId: medicine.id, quantityChange: -3, reason: 'Écart inventaire'})
    ).rejects.toMatchObject({code: 'INSUFFICIENT_STOCK'});
    const [stored] = await db.select().from(medicines).where(eq(medicines.id, medicine.id));
    expect(stored.currentStock).toBe(2);
    await expect(db.select().from(stockMovements)).resolves.toEqual([]);
  });
});
