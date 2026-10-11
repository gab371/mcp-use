import { describe, expect, it } from 'vitest';
import { Expense } from '../src/domain/models/expense.entity.js';
import { Participant } from '../src/domain/models/participant.entity.js';
import { DebtSimplifier } from '../src/domain/services/debt-simplifier.service.js';
import { Money } from '../src/domain/value-objects/money.vo.js';

describe('DebtSimplifier (Domain Algorithm)', () => {
  it('simplifies transitive debts (A owes B, B owes C -> A owes C directly)', () => {
    const alice = new Participant('p-1', 'Alice');
    const bob = new Participant('p-2', 'Bob');
    const charlie = new Participant('p-3', 'Charlie');
    const participants = [alice, bob, charlie];

    // Bob paid 100 EUR for Alice only (Alice owes Bob 100)
    const exp1 = new Expense(
      'e-1',
      'g-1',
      'Bob paid for Alice',
      bob.id,
      new Money(100, 'EUR'),
      [alice.id]
    );

    // Charlie paid 100 EUR for Bob only (Bob owes Charlie 100)
    const exp2 = new Expense(
      'e-2',
      'g-1',
      'Charlie paid for Bob',
      charlie.id,
      new Money(100, 'EUR'),
      [bob.id]
    );

    const settlements = DebtSimplifier.simplifyDebts(
      participants,
      [exp1, exp2],
      'EUR'
    );

    // Instead of 2 transactions (Alice -> Bob and Bob -> Charlie),
    // the algorithm should produce exactly 1 transaction: Alice owes Charlie 100 EUR!
    expect(settlements).toHaveLength(1);
    expect(settlements[0].fromName).toBe('Alice');
    expect(settlements[0].toName).toBe('Charlie');
    expect(settlements[0].amount.amount).toBe(100);
  });

  it('correctly calculates balances for a group split', () => {
    const alice = new Participant('p-1', 'Alice');
    const bob = new Participant('p-2', 'Bob');
    const participants = [alice, bob];

    // Dinner 60 EUR paid by Alice split equally between Alice and Bob
    const exp = new Expense(
      'e-1',
      'g-1',
      'Dinner',
      alice.id,
      new Money(60, 'EUR'),
      [alice.id, bob.id]
    );

    const balances = DebtSimplifier.computeBalances(participants, [exp], 'EUR');

    const aliceBal = balances.find((b) => b.participantId === alice.id);
    const bobBal = balances.find((b) => b.participantId === bob.id);

    expect(aliceBal?.netBalance).toBe(30);
    expect(bobBal?.netBalance).toBe(-30);

    const settlements = DebtSimplifier.simplifyDebts(participants, [exp], 'EUR');
    expect(settlements).toHaveLength(1);
    expect(settlements[0].fromName).toBe('Bob');
    expect(settlements[0].toName).toBe('Alice');
    expect(settlements[0].amount.amount).toBe(30);
  });
});
