import { Injectable } from '@nestjs/common';
import type { CurrencyConverterPort } from '../../domain/ports/currency-converter.port.js';
import { Money } from '../../domain/value-objects/money.vo.js';

@Injectable()
export class MockCurrencyConverterAdapter implements CurrencyConverterPort {
  private readonly ratesToEur: Record<string, number> = {
    EUR: 1.0,
    USD: 0.92,
    GBP: 1.17,
    CHF: 1.04,
  };

  getBaseCurrency(): string {
    return 'EUR';
  }

  async convert(amount: Money, targetCurrency: string): Promise<Money> {
    if (amount.currency === targetCurrency) {
      return amount;
    }

    const rateFrom = this.ratesToEur[amount.currency] ?? 1.0;
    const rateTo = this.ratesToEur[targetCurrency] ?? 1.0;

    const inEur = amount.amount * rateFrom;
    const converted = inEur / rateTo;
    const rounded = Math.round(converted * 100) / 100;

    return new Money(rounded, targetCurrency);
  }
}
