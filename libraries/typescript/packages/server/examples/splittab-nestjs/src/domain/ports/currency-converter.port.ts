import type { Money } from '../value-objects/money.vo.js';

export const CURRENCY_CONVERTER_PORT = Symbol('CURRENCY_CONVERTER_PORT');

export interface CurrencyConverterPort {
  convert(amount: Money, targetCurrency: string): Promise<Money>;
  getBaseCurrency(): string;
}
