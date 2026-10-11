export class Money {
  constructor(
    public readonly amount: number,
    public readonly currency: string = 'EUR'
  ) {
    if (isNaN(amount)) {
      throw new Error('Money amount must be a valid number');
    }
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(
      Math.round((this.amount + other.amount) * 100) / 100,
      this.currency
    );
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(
      Math.round((this.amount - other.amount) * 100) / 100,
      this.currency
    );
  }

  format(): string {
    return `${this.amount.toFixed(2)} ${this.currency}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(
        `Cannot operate on different currencies: ${this.currency} vs ${other.currency}`
      );
    }
  }
}
