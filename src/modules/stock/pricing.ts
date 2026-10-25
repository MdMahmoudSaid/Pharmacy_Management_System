import Decimal from 'decimal.js';

export function projectReceiptPricing(input: {
  currentStock: number;
  averageCost: string;
  quantity: number;
  // Either the unit cost, or the total that was paid for the whole line (the unit cost is derived from it).
  unitCost?: string;
  totalCost?: string;
  markupPercent?: number;
}) {
  const quantity = new Decimal(input.quantity);
  const totalCost = input.totalCost !== undefined
    ? new Decimal(input.totalCost || 0)
    : quantity.times(new Decimal(input.unitCost || 0));
  const stockAfter = input.currentStock + input.quantity;
  const projectedAverageCost = stockAfter > 0
    ? new Decimal(input.averageCost || 0)
      .times(input.currentStock)
      .plus(totalCost)
      .dividedBy(stockAfter)
    : new Decimal(0);
  const multiplier = new Decimal(1).plus(new Decimal(input.markupPercent ?? 20).dividedBy(100));
  // What this purchase cost per unit. Stock that was added without a cost (manual adjustments) counts as free
  // in the average, which would pull the average, and any price built on it, below what was just paid.
  const purchaseUnitCost = input.quantity > 0 ? totalCost.dividedBy(input.quantity) : new Decimal(0);
  const referenceCost = Decimal.max(projectedAverageCost, purchaseUnitCost);
  const suggestedSellingPrice = referenceCost
    .times(multiplier)
    .toDecimalPlaces(2, Decimal.ROUND_CEIL);

  return {
    unitCost: unitCostFromTotal(totalCost, input.quantity).toFixed(2),
    totalCost: totalCost.toFixed(2),
    projectedAverageCost: projectedAverageCost.toFixed(2),
    // The cost a selling price is judged against: the higher of this purchase and the running average.
    referenceCost: referenceCost.toDecimalPlaces(2, Decimal.ROUND_CEIL).toFixed(2),
    suggestedSellingPrice: suggestedSellingPrice.toFixed(2)
  };
}

// What one unit cost when `total` was paid for `quantity` units, to the nearest cent.
export function unitCostFromTotal(total: Decimal.Value, quantity: number) {
  return quantity > 0 ? new Decimal(total).dividedBy(quantity).toDecimalPlaces(2, Decimal.ROUND_HALF_UP) : new Decimal(0);
}
