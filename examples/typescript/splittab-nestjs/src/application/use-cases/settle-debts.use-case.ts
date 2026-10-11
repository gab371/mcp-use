import { Inject, Injectable } from '@nestjs/common';
import type { Settlement } from '../../domain/models/settlement.entity.js';
import {
  CURRENCY_CONVERTER_PORT,
  type CurrencyConverterPort,
} from '../../domain/ports/currency-converter.port.js';
import {
  EXPENSE_REPOSITORY_PORT,
  type ExpenseRepositoryPort,
} from '../../domain/ports/expense-repository.port.js';
import { DebtSimplifier } from '../../domain/services/debt-simplifier.service.js';

@Injectable()
export class SettleDebtsUseCase {
  constructor(
    @Inject(EXPENSE_REPOSITORY_PORT)
    private readonly expenseRepo: ExpenseRepositoryPort,
    @Inject(CURRENCY_CONVERTER_PORT)
    private readonly currencyConverter: CurrencyConverterPort
  ) {}

  async execute(groupId: string): Promise<Settlement[]> {
    const participants = await this.expenseRepo.findParticipantsByGroupId(groupId);
    const expenses = await this.expenseRepo.findExpensesByGroupId(groupId);
    const currency = this.currencyConverter.getBaseCurrency();

    return DebtSimplifier.simplifyDebts(participants, expenses, currency);
  }
}
