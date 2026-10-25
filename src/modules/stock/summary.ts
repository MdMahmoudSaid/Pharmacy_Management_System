import Decimal from 'decimal.js';

type StockItem = {
  currentStock: number;
  minStock: number;
  averageCost: Decimal.Value;
  sellingPrice: Decimal.Value;
  isActive: boolean;
};

export function summarizeStock(items: StockItem[]) {
  const active = items.filter((item) => item.isActive);
  const result = active.reduce(
    (summary, item) => {
      const isOut = item.currentStock === 0;
      const isLow = item.currentStock > 0 && item.currentStock <= item.minStock;
      return {
        units: summary.units + item.currentStock,
        costValue: summary.costValue.plus(new Decimal(item.averageCost).times(item.currentStock)),
        retailValue: summary.retailValue.plus(new Decimal(item.sellingPrice).times(item.currentStock)),
        lowCount: summary.lowCount + Number(isLow),
        outCount: summary.outCount + Number(isOut)
      };
    },
    {units: 0, costValue: new Decimal(0), retailValue: new Decimal(0), lowCount: 0, outCount: 0}
  );

  return {
    medicineCount: active.length,
    units: result.units,
    costValue: result.costValue.toFixed(2),
    retailValue: result.retailValue.toFixed(2),
    lowCount: result.lowCount,
    outCount: result.outCount,
    alertCount: result.lowCount + result.outCount
  };
}
