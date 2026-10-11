import type { ParticipantBalance } from '../../domain/services/debt-simplifier.service.js';

export interface GroupSummaryDto {
  groupId: string;
  currency: string;
  expenseCount: number;
  totalGroupSpending: number;
  totalGroupSpendingFormatted: string;
  balances: ParticipantBalance[];
  settlements: {
    from: string;
    to: string;
    amount: number;
    formatted: string;
  }[];
}
