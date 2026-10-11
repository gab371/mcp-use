import { Injectable } from '@nestjs/common';
import { Expense } from '../../domain/models/expense.entity.js';
import { Participant } from '../../domain/models/participant.entity.js';
import type { ExpenseRepositoryPort } from '../../domain/ports/expense-repository.port.js';
import { Money } from '../../domain/value-objects/money.vo.js';

@Injectable()
export class InMemoryExpenseRepository implements ExpenseRepositoryPort {
  private readonly expenses = new Map<string, Expense[]>();
  private readonly participants = new Map<string, Participant[]>();

  constructor() {
    this.seedDefaultGroup();
  }

  async saveExpense(expense: Expense): Promise<void> {
    const list = this.expenses.get(expense.groupId) ?? [];
    list.push(expense);
    this.expenses.set(expense.groupId, list);
  }

  async findExpensesByGroupId(groupId: string): Promise<Expense[]> {
    return this.expenses.get(groupId) ?? [];
  }

  async findParticipantsByGroupId(groupId: string): Promise<Participant[]> {
    return this.participants.get(groupId) ?? [];
  }

  async saveParticipant(
    groupId: string,
    participant: Participant
  ): Promise<void> {
    const list = this.participants.get(groupId) ?? [];
    if (!list.some((p) => p.id === participant.id)) {
      list.push(participant);
      this.participants.set(groupId, list);
    }
  }

  private seedDefaultGroup(): void {
    const groupId = 'weekend-alps';
    const alice = new Participant('p-1', 'Alice', 'alice@example.com');
    const bob = new Participant('p-2', 'Bob', 'bob@example.com');
    const charlie = new Participant('p-3', 'Charlie', 'charlie@example.com');
    const dana = new Participant('p-4', 'Dana', 'dana@example.com');

    this.participants.set(groupId, [alice, bob, charlie, dana]);

    const exp1 = new Expense(
      'exp-1',
      groupId,
      'Chalet Rental (4 nights)',
      alice.id,
      new Money(400, 'EUR'),
      [alice.id, bob.id, charlie.id, dana.id],
      'Accommodation'
    );

    const exp2 = new Expense(
      'exp-2',
      groupId,
      'Fondue Dinner & Groceries',
      bob.id,
      new Money(120, 'EUR'),
      [alice.id, bob.id, charlie.id, dana.id],
      'Food'
    );

    const exp3 = new Expense(
      'exp-3',
      groupId,
      'Ski Passes (Charlie & Dana)',
      charlie.id,
      new Money(200, 'EUR'),
      [charlie.id, dana.id],
      'Activities'
    );

    const exp4 = new Expense(
      'exp-4',
      groupId,
      'Highway Tolls & Fuel',
      dana.id,
      new Money(80, 'EUR'),
      [alice.id, bob.id, charlie.id, dana.id],
      'Transport'
    );

    this.expenses.set(groupId, [exp1, exp2, exp3, exp4]);
  }
}
