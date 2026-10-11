import { Inject, Injectable } from '@nestjs/common';
import { Expense } from '../../domain/models/expense.entity.js';
import { Participant } from '../../domain/models/participant.entity.js';
import {
  CURRENCY_CONVERTER_PORT,
  type CurrencyConverterPort,
} from '../../domain/ports/currency-converter.port.js';
import {
  EXPENSE_REPOSITORY_PORT,
  type ExpenseRepositoryPort,
} from '../../domain/ports/expense-repository.port.js';
import { Money } from '../../domain/value-objects/money.vo.js';
import type { AddExpenseDto } from '../dto/add-expense.dto.js';

@Injectable()
export class AddExpenseUseCase {
  constructor(
    @Inject(EXPENSE_REPOSITORY_PORT)
    private readonly expenseRepo: ExpenseRepositoryPort,
    @Inject(CURRENCY_CONVERTER_PORT)
    private readonly currencyConverter: CurrencyConverterPort
  ) {}

  async execute(dto: AddExpenseDto): Promise<Expense> {
    const existingParticipants = await this.expenseRepo.findParticipantsByGroupId(
      dto.groupId
    );
    const participantMap = new Map<string, Participant>(
      existingParticipants.map((p) => [p.name.toLowerCase(), p])
    );

    // Resolve or auto-register payer
    let payer = participantMap.get(dto.paidByName.trim().toLowerCase());
    if (!payer) {
      payer = new Participant(
        `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        dto.paidByName.trim()
      );
      await this.expenseRepo.saveParticipant(dto.groupId, payer);
      participantMap.set(payer.name.toLowerCase(), payer);
    }

    // Resolve or auto-register split members
    const splitBetweenIds: string[] = [];
    for (const name of dto.splitBetweenNames) {
      const normalizedName = name.trim();
      let participant = participantMap.get(normalizedName.toLowerCase());
      if (!participant) {
        participant = new Participant(
          `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          normalizedName
        );
        await this.expenseRepo.saveParticipant(dto.groupId, participant);
        participantMap.set(participant.name.toLowerCase(), participant);
      }
      splitBetweenIds.push(participant.id);
    }

    // Currency conversion if needed
    const baseCurrency = this.currencyConverter.getBaseCurrency();
    const inputCurrency = dto.currency ?? baseCurrency;
    const initialMoney = new Money(dto.amount, inputCurrency);
    const normalizedMoney = await this.currencyConverter.convert(
      initialMoney,
      baseCurrency
    );

    const expense = new Expense(
      `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      dto.groupId,
      dto.description,
      payer.id,
      normalizedMoney,
      splitBetweenIds,
      dto.category ?? 'General'
    );

    await this.expenseRepo.saveExpense(expense);
    return expense;
  }
}
