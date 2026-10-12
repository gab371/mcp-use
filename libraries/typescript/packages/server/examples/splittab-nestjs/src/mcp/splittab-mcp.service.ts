import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  McpContext,
  McpPrompt,
  McpResource,
  McpTool,
} from '@mcp-use/nestjs';
import { AddExpenseUseCase } from '../application/use-cases/add-expense.use-case.js';
import { GetGroupSummaryUseCase } from '../application/use-cases/get-group-summary.use-case.js';
import { SettleDebtsUseCase } from '../application/use-cases/settle-debts.use-case.js';

@Injectable()
export class SplitTabMcpService {
  constructor(
    @Inject(AddExpenseUseCase)
    private readonly addExpenseUseCase: AddExpenseUseCase,
    @Inject(GetGroupSummaryUseCase)
    private readonly getGroupSummaryUseCase: GetGroupSummaryUseCase,
    @Inject(SettleDebtsUseCase)
    private readonly settleDebtsUseCase: SettleDebtsUseCase
  ) {}

  @McpTool({
    name: 'add_expense',
    description: 'Add a new shared expense to the group budget',
    inputSchema: z.object({
      groupId: z
        .string()
        .default('weekend-alps')
        .describe('Group identifier (default: "weekend-alps")'),
      description: z.string().describe('What was paid for, e.g. "Dinner & wine"'),
      paidByName: z.string().describe('Name of the person who paid upfront'),
      amount: z.number().positive().describe('Total amount paid'),
      currency: z
        .string()
        .optional()
        .describe('Currency code (EUR, USD, GBP, CHF) - defaults to group base currency'),
      splitBetweenNames: z
        .array(z.string())
        .min(1)
        .describe('Names of participants sharing this expense'),
      category: z.string().optional().describe('Expense category'),
    }),
  })
  async addExpense(
    args: {
      groupId: string;
      description: string;
      paidByName: string;
      amount: number;
      currency?: string;
      splitBetweenNames: string[];
      category?: string;
    },
    @McpContext() ctx?: any
  ) {
    const expense = await this.addExpenseUseCase.execute(args);
    const session = ctx?.params?._meta?.['openai/session'] ?? 'local';

    return {
      content: [
        {
          type: 'text',
          text: `Added expense "${expense.description}" (${expense.amount.format()}) paid by ${args.paidByName}, split among ${args.splitBetweenNames.join(', ')}.\n[Audit session: ${session}]`,
        },
      ],
    };
  }

  @McpTool({
    name: 'get_group_summary',
    description: 'Get total group spending, individual balances, and debt settlements',
    inputSchema: z.object({
      groupId: z
        .string()
        .default('weekend-alps')
        .describe('Group identifier (default: "weekend-alps")'),
    }),
  })
  async getGroupSummary({ groupId }: { groupId: string }) {
    const summary = await this.getGroupSummaryUseCase.execute(groupId);

    return {
      content: [
        {
          type: 'text',
          text: `=== Group Budget Summary: "${summary.groupId}" ===\nTotal Group Spending: ${summary.totalGroupSpendingFormatted} (${summary.expenseCount} expenses)\n\n--- Net Balances ---\n${summary.balances
            .map(
              (b) =>
                `• ${b.participantName}: paid ${b.totalPaid} ${summary.currency}, share ${b.totalOwed} ${summary.currency} -> Net: ${b.netBalance >= 0 ? '+' : ''}${b.netBalance} ${summary.currency}`
            )
            .join('\n')}\n\n--- Suggested Minimal Settlements ---\n${
            summary.settlements.length > 0
              ? summary.settlements.map((s) => `• ${s.formatted}`).join('\n')
              : 'All balances settled!'
          }`,
        },
      ],
    };
  }

  @McpTool({
    name: 'settle_debts',
    description: 'Calculate the minimum number of cash transfers required to settle all debts in the group',
    inputSchema: z.object({
      groupId: z
        .string()
        .default('weekend-alps')
        .describe('Group identifier'),
    }),
  })
  async settleDebts({ groupId }: { groupId: string }) {
    const settlements = await this.settleDebtsUseCase.execute(groupId);

    return {
      content: [
        {
          type: 'text',
          text: `Optimal Debt Simplification (${settlements.length} transfer(s) required):\n${
            settlements.length > 0
              ? settlements.map((s) => `• ${s.format()}`).join('\n')
              : 'All participants are even! No transfers needed.'
          }`,
        },
      ],
    };
  }

  @McpResource({
    uri: 'splittab://groups/summary',
    name: 'group-summary-resource',
    title: 'Live Group Budget Ledger',
    description: 'JSON snapshot of all group balances and simplified debts',
    mimeType: 'application/json',
  })
  async getGroupSummaryResource(uri: any) {
    const summary = await this.getGroupSummaryUseCase.execute('weekend-alps');

    return {
      contents: [
        {
          uri: String(uri),
          mimeType: 'application/json',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  @McpPrompt({
    name: 'remind_debtor',
    title: 'Reimbursement Reminder Prompt',
    description: 'Generates a polite, natural reimbursement reminder message for a debtor',
    inputSchema: z.object({
      debtorName: z.string().describe('Name of the debtor to remind'),
      channel: z.enum(['slack', 'whatsapp', 'email']).default('whatsapp'),
    }),
  })
  async remindDebtorPrompt({
    debtorName,
    channel,
  }: {
    debtorName: string;
    channel: 'slack' | 'whatsapp' | 'email';
  }) {
    const summary = await this.getGroupSummaryUseCase.execute('weekend-alps');
    const debts = summary.settlements.filter(
      (s) => s.from.toLowerCase() === debtorName.toLowerCase()
    );

    const context =
      debts.length > 0
        ? debts.map((d) => `${d.from} owes ${d.to} ${d.amount} ${summary.currency}`).join(', ')
        : `${debtorName} has no pending debts in the group.`;

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Write a friendly, relaxed ${channel} message reminding ${debtorName} about their share of the group expenses. Current balance: ${context}. Keep it casual and friendly.`,
          },
        },
      ],
    };
  }
}
