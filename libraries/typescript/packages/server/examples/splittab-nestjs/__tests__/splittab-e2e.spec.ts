import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.js';
import { SplitTabMcpService } from '../src/mcp/splittab-mcp.service.js';

describe('SplitTab NestJS Hexagonal E2E Integration', () => {
  it('initializes NestJS container, executes MCP tools through use cases, and settles debts', async () => {
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });

    try {
      const mcpService = app.get(SplitTabMcpService);
      expect(mcpService).toBeDefined();

      // 1. Get initial seeded group summary
      const summaryResult = await mcpService.getGroupSummary({
        groupId: 'weekend-alps',
      });
      expect(summaryResult.content[0].text).toContain('weekend-alps');
      expect(summaryResult.content[0].text).toContain('Alice');
      expect(summaryResult.content[0].text).toContain('Bob');

      // 2. Add a new expense through the MCP tool
      const addResult = await mcpService.addExpense(
        {
          groupId: 'weekend-alps',
          description: 'Spa & Sauna pass',
          paidByName: 'Dana',
          amount: 100,
          currency: 'EUR',
          splitBetweenNames: ['Alice', 'Dana'],
          category: 'Wellness',
        },
        { params: { _meta: { 'openai/session': 'test-session-123' } } }
      );

      expect(addResult.content[0].text).toContain('Spa & Sauna pass');
      expect(addResult.content[0].text).toContain('test-session-123');

      // 3. Settle debts with the domain simplification algorithm
      const settleResult = await mcpService.settleDebts({
        groupId: 'weekend-alps',
      });
      expect(settleResult.content[0].text).toContain('Optimal Debt Simplification');
      expect(settleResult.content[0].text).toContain('owes');

      // 4. Test prompt generation
      const promptResult = await mcpService.remindDebtorPrompt({
        debtorName: 'Bob',
        channel: 'whatsapp',
      });
      expect(promptResult.messages[0].content.text).toContain('whatsapp');
      expect(promptResult.messages[0].content.text).toContain('Bob');
    } finally {
      await app.close();
    }
  });
});
