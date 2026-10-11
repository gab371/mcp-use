import type { Money } from '../value-objects/money.vo.js';

export class Settlement {
  constructor(
    public readonly fromId: string,
    public readonly fromName: string,
    public readonly toId: string,
    public readonly toName: string,
    public readonly amount: Money
  ) {}

  format(): string {
    return `${this.fromName} owes ${this.toName} ${this.amount.format()}`;
  }
}
