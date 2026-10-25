import Decimal from 'decimal.js';

export function projectReceiptPricing(input: {
  currentStock: number;
  averageCost: string;
  quantity: number;
  unitCost: string;
  markupPercent?: number;
}) {
  const quantity = new Decimal(input.quantity);
  const unitCost = new Decimal(input.unitCost || 0);
  const totalCost = quantity.times(unitCost);
  const stockAfter = input.currentStock + input.quantity;
  const projectedAverageCost = stockAfter > 0
    ? new Decimal(input.averageCost || 0)
      .times(input.currentStock)
      .plus(totalCost)
      .dividedBy(stockAfter)
    : new Decimal(0);
  const multiplier = new Decimal(1).plus(new Decimal(input.markupPercent ?? 20).dividedBy(100));
  const suggestedSellingPrice = projectedAverageCost
    .times(multiplier)
    .toDecimalPlaces(2, Decimal.ROUND_CEIL);

  return {
    totalCost: totalCost.toFixed(2),
    projectedAverageCost: projectedAverageCost.toFixed(2),
    suggestedSellingPrice: suggestedSellingPrice.toFixed(2)
  };
}
