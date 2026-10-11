import type { Money } from '../value-objects/money.vo.js';

export class Expense {
  constructor(
    public readonly id: string,
    public readonly groupId: string,
    public readonly description: string,
    public readonly paidById: string,
    public readonly amount: Money,
    public readonly splitBetweenIds: string[],
    public readonly category: string = 'General',
    public readonly createdAt: Date = new Date()
  ) {
    if (!description || description.trim().length === 0) {
      throw new Error('Expense description cannot be empty');
    }
    if (splitBetweenIds.length === 0) {
      throw new Error('Expense must be split between at least one participant');
    }
    if (amount.amount <= 0) {
      throw new Error('Expense amount must be positive');
    }
  }

  getSharePerParticipant(): number {
    return Math.round((this.amount.amount / this.splitBetweenIds.length) * 100) / 100;
  }
}
