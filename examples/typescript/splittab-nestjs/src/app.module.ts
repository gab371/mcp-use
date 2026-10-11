import { Module } from '@nestjs/common';
import { McpModule } from '@mcp-use/nestjs';
import { AddExpenseUseCase } from './application/use-cases/add-expense.use-case.js';
import { GetGroupSummaryUseCase } from './application/use-cases/get-group-summary.use-case.js';
import { SettleDebtsUseCase } from './application/use-cases/settle-debts.use-case.js';
import { CURRENCY_CONVERTER_PORT } from './domain/ports/currency-converter.port.js';
import { EXPENSE_REPOSITORY_PORT } from './domain/ports/expense-repository.port.js';
import { InMemoryExpenseRepository } from './infrastructure/adapters/in-memory-expense.repository.js';
import { MockCurrencyConverterAdapter } from './infrastructure/adapters/mock-currency-converter.adapter.js';
import { SplitTabConfigService } from './infrastructure/config/splittab-config.service.js';
import { SplitTabMcpService } from './mcp/splittab-mcp.service.js';

@Module({
  imports: [
    McpModule.forRootAsync({
      useClass: SplitTabConfigService,
    }),
  ],
  providers: [
    // Secondary adapters (Infrastructure bound to Domain Ports)
    {
      provide: EXPENSE_REPOSITORY_PORT,
      useClass: InMemoryExpenseRepository,
    },
    {
      provide: CURRENCY_CONVERTER_PORT,
      useClass: MockCurrencyConverterAdapter,
    },
    SplitTabConfigService,

    // Application Use Cases
    AddExpenseUseCase,
    SettleDebtsUseCase,
    GetGroupSummaryUseCase,

    // Primary Delivery Adapter (MCP Server Tools & Prompts)
    SplitTabMcpService,
  ],
})
export class AppModule {}
