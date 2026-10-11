import type { Expense } from '../models/expense.entity.js';
import type { Participant } from '../models/participant.entity.js';
import { Settlement } from '../models/settlement.entity.js';
import { Money } from '../value-objects/money.vo.js';

export interface ParticipantBalance {
  participantId: string;
  participantName: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number;
}

export class DebtSimplifier {
  /**
   * Computes individual net balances for all participants in a group.
   */
  static computeBalances(
    participants: Participant[],
    expenses: Expense[],
    currency: string = 'EUR'
  ): ParticipantBalance[] {
    const participantMap = new Map<string, Participant>(
      participants.map((p) => [p.id, p])
    );

    const paidMap = new Map<string, number>();
    const owedMap = new Map<string, number>();

    for (const p of participants) {
      paidMap.set(p.id, 0);
      owedMap.set(p.id, 0);
    }

    for (const expense of expenses) {
      // Accumulate amount paid
      const currentPaid = paidMap.get(expense.paidById) ?? 0;
      paidMap.set(expense.paidById, currentPaid + expense.amount.amount);

      // Accumulate share owed
      const share = expense.getSharePerParticipant();
      for (const debtorId of expense.splitBetweenIds) {
        const currentOwed = owedMap.get(debtorId) ?? 0;
        owedMap.set(debtorId, currentOwed + share);
      }
    }

    return participants.map((p) => {
      const totalPaid = Math.round((paidMap.get(p.id) ?? 0) * 100) / 100;
      const totalOwed = Math.round((owedMap.get(p.id) ?? 0) * 100) / 100;
      const netBalance = Math.round((totalPaid - totalOwed) * 100) / 100;

      return {
        participantId: p.id,
        participantName: p.name,
        totalPaid,
        totalOwed,
        netBalance,
      };
    });
  }

  /**
   * Simplifies group debts using a greedy minimum cash-flow algorithm.
   */
  static simplifyDebts(
    participants: Participant[],
    expenses: Expense[],
    currency: string = 'EUR'
  ): Settlement[] {
    const balances = this.computeBalances(participants, expenses, currency);
    const participantNames = new Map<string, string>(
      participants.map((p) => [p.id, p.name])
    );

    // Filter into creditors (net > 0) and debtors (net < 0)
    const creditors: { id: string; amount: number }[] = [];
    const debtors: { id: string; amount: number }[] = [];

    for (const b of balances) {
      if (b.netBalance > 0.01) {
        creditors.push({ id: b.participantId, amount: b.netBalance });
      } else if (b.netBalance < -0.01) {
        debtors.push({ id: b.participantId, amount: Math.abs(b.netBalance) });
      }
    }

    // Sort descending to greedily pair largest debts first
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const settlements: Settlement[] = [];

    let cIdx = 0;
    let dIdx = 0;

    while (cIdx < creditors.length && dIdx < debtors.length) {
      const creditor = creditors[cIdx];
      const debtor = debtors[dIdx];

      const settlementAmount = Math.min(creditor.amount, debtor.amount);
      const roundedAmount = Math.round(settlementAmount * 100) / 100;

      if (roundedAmount > 0) {
        settlements.push(
          new Settlement(
            debtor.id,
            participantNames.get(debtor.id) ?? debtor.id,
            creditor.id,
            participantNames.get(creditor.id) ?? creditor.id,
            new Money(roundedAmount, currency)
          )
        );
      }

      creditor.amount = Math.round((creditor.amount - settlementAmount) * 100) / 100;
      debtor.amount = Math.round((debtor.amount - settlementAmount) * 100) / 100;

      if (creditor.amount <= 0.01) {
        cIdx++;
      }
      if (debtor.amount <= 0.01) {
        dIdx++;
      }
    }

    return settlements;
  }
}
