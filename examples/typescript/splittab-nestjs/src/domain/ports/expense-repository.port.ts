import type { Expense } from '../models/expense.entity.js';
import type { Participant } from '../models/participant.entity.js';

export const EXPENSE_REPOSITORY_PORT = Symbol('EXPENSE_REPOSITORY_PORT');

export interface ExpenseRepositoryPort {
  saveExpense(expense: Expense): Promise<void>;
  findExpensesByGroupId(groupId: string): Promise<Expense[]>;
  findParticipantsByGroupId(groupId: string): Promise<Participant[]>;
  saveParticipant(groupId: string, participant: Participant): Promise<void>;
}
