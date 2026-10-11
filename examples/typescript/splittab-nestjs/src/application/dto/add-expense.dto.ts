export interface AddExpenseDto {
  groupId: string;
  description: string;
  paidByName: string;
  amount: number;
  currency?: string;
  splitBetweenNames: string[];
  category?: string;
}
