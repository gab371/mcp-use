import { Inject, Injectable } from '@nestjs/common';
import {
  CURRENCY_CONVERTER_PORT,
  type CurrencyConverterPort,
} from '../../domain/ports/currency-converter.port.js';
import {
  EXPENSE_REPOSITORY_PORT,
  type ExpenseRepositoryPort,
} from '../../domain/ports/expense-repository.port.js';
import { DebtSimplifier } from '../../domain/services/debt-simplifier.service.js';
import type { GroupSummaryDto } from '../dto/group-summary.dto.js';

@Injectable()
export class GetGroupSummaryUseCase {
  constructor(
    @Inject(EXPENSE_REPOSITORY_PORT)
    private readonly expenseRepo: ExpenseRepositoryPort,
    @Inject(CURRENCY_CONVERTER_PORT)
    private readonly currencyConverter: CurrencyConverterPort
  ) {}

  async execute(groupId: string): Promise<GroupSummaryDto> {
    const participants = await this.expenseRepo.findParticipantsByGroupId(groupId);
    const expenses = await this.expenseRepo.findExpensesByGroupId(groupId);
    const currency = this.currencyConverter.getBaseCurrency();

    const balances = DebtSimplifier.computeBalances(participants, expenses, currency);
    const settlements = DebtSimplifier.simplifyDebts(participants, expenses, currency);

    const totalSpending = expenses.reduce((acc, exp) => acc + exp.amount.amount, 0);
    const roundedSpending = Math.round(totalSpending * 100) / 100;

    return {
      groupId,
      currency,
      expenseCount: expenses.length,
      totalGroupSpending: roundedSpending,
      totalGroupSpendingFormatted: `${roundedSpending.toFixed(2)} ${currency}`,
      balances,
      settlements: settlements.map((s) => ({
        from: s.fromName,
        to: s.toName,
        amount: s.amount.amount,
        formatted: s.format(),
      })),
    };
  }
}
