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
      unitCost: '15.00',
      totalCost: '150.00',
      projectedAverageCost: '10.00',
      referenceCost: '15.00',
      // 20% on the 15.00 just paid, not on the 10.00 average.
      suggestedSellingPrice: '18.00'
    });
  });

  it('rounds the suggested price upward so it remains profitable', () => {
    expect(projectReceiptPricing({
      currentStock: 0,
      averageCost: '0.00',
      quantity: 3,
      unitCost: '7.33'
    })).toEqual({
      unitCost: '7.33',
      totalCost: '21.99',
      projectedAverageCost: '7.33',
      referenceCost: '7.33',
      suggestedSellingPrice: '8.80'
    });
  });

  it('works from the total paid: the unit cost is the total divided by the quantity', () => {
    expect(projectReceiptPricing({
      currentStock: 0,
      averageCost: '0.00',
      quantity: 3,
      totalCost: '1000.00'
    })).toEqual({
      unitCost: '333.33',
      totalCost: '1000.00',
      projectedAverageCost: '333.33',
      referenceCost: '333.34',
      suggestedSellingPrice: '400.00'
    });
  });

  it('never suggests less than what was just paid, even when old stock has no cost', () => {
    // 9 units added by hand (cost 0), then 10 bought for 10,000: the average falls to 526.32.
    const result = projectReceiptPricing({currentStock: 9, averageCost: '0.00', quantity: 10, totalCost: '10000.00'});
    expect(result.projectedAverageCost).toBe('526.32');
    expect(result.unitCost).toBe('1000.00');
    expect(result.referenceCost).toBe('1000.00');
    expect(result.suggestedSellingPrice).toBe('1200.00');
  });

  it('keeps using the average when old stock cost more than the new purchase', () => {
    const result = projectReceiptPricing({currentStock: 10, averageCost: '30.00', quantity: 10, totalCost: '100.00'});
    expect(result.projectedAverageCost).toBe('20.00');
    expect(result.referenceCost).toBe('20.00');
    expect(result.suggestedSellingPrice).toBe('24.00');
  });
});
