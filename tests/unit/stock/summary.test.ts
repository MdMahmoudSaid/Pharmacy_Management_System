import {describe, expect, it} from 'vitest';

import {summarizeStock} from '@/modules/stock/summary';

describe('stock summary', () => {
  it('totals active medicines and separates low and out-of-stock alerts', () => {
    expect(summarizeStock([
      {currentStock: 10, minStock: 3, averageCost: '5.00', sellingPrice: '8.00', isActive: true},
      {currentStock: 2, minStock: 3, averageCost: '10.00', sellingPrice: '15.00', isActive: true},
      {currentStock: 0, minStock: 2, averageCost: '7.00', sellingPrice: '12.00', isActive: true},
      {currentStock: 100, minStock: 5, averageCost: '99.00', sellingPrice: '150.00', isActive: false}
    ])).toEqual({
      medicineCount: 3,
      units: 12,
      costValue: '70.00',
      retailValue: '110.00',
      lowCount: 1,
      outCount: 1,
      alertCount: 2
    });
  });
});
