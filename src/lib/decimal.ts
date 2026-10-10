import Decimal from 'decimal.js';

const databaseMoney = (value: Decimal.Value) => new Decimal(value).toFixed(2);

export const money = {
  add(left: Decimal.Value, right: Decimal.Value) {
    return databaseMoney(new Decimal(left).plus(right));
  },
  multiply(value: Decimal.Value, quantity: number) {
    return databaseMoney(new Decimal(value).times(quantity));
  },
  format(value: Decimal.Value, locale: string) {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(new Decimal(value).toNumber());
  }
};
