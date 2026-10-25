import {describe, expect, it} from 'vitest';

import {projectReceiptPricing} from '@/modules/stock/pricing';

describe('stock receipt pricing', () => {
  it('projects weighted average cost and a 20 percent profitable price', () => {
    expect(projectReceiptPricing({
      currentStock: 10,
      averageCost: '5.00',
      quantity: 10,
      unitCost: '15.00'
    })).toEqual({
      totalCost: '150.00',
      projectedAverageCost: '10.00',
      suggestedSellingPrice: '12.00'
    });
  });

  it('rounds the suggested price upward so it remains profitable', () => {
    expect(projectReceiptPricing({
      currentStock: 0,
      averageCost: '0.00',
      quantity: 3,
      unitCost: '7.33'
    })).toEqual({
      totalCost: '21.99',
      projectedAverageCost: '7.33',
      suggestedSellingPrice: '8.80'
    });
  });
});
