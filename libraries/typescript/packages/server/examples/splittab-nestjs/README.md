# SplitTab — Enterprise NestJS MCP Server (Hexagonal Architecture)

> Shared Expense Tracker & Debt Settlement AI Assistant demonstrating **Hexagonal Architecture (Ports & Adapters)** and `@mcp-use/nestjs`.

---

## Architecture

This service isolates business rules from AI transport and databases:

```
src/
├── domain/                  # Pure TypeScript domain (0 external dependencies)
│   ├── models/              # Expense, Participant, Settlement entities
│   ├── value-objects/       # Money value object with currency arithmetic
│   ├── ports/               # ExpenseRepositoryPort, CurrencyConverterPort
│   └── services/            # DebtSimplifier (minimum cash-flow algorithm)
│
├── application/             # Application Use Cases & DTOs
│   ├── use-cases/           # AddExpense, SettleDebts, GetGroupSummary
│   └── dto/                 # Input/Output DTO contracts
│
├── infrastructure/          # Secondary Adapters
│   ├── adapters/            # InMemoryExpenseRepository, MockCurrencyConverter
│   └── config/              # SplitTabConfigService (McpOptionsFactory)
│
└── mcp/                     # Primary Adapter (Delivery via @mcp-use/nestjs)
    └── splittab-mcp.service # @McpTool(), @McpResource(), @McpPrompt(), @McpContext()
```

---

## Demonstrated Concepts

1. **Hexagonal Architecture in MCP:** AI tools communicate strictly through Application Use Cases and Domain Ports.
2. **Dynamic Async Module:** `McpModule.forRootAsync({ useClass: SplitTabConfigService })` dynamically resolves server options.
3. **Graph Algorithm:** `DebtSimplifier` pairs largest debtors with largest creditors to minimize total transactions.
4. **Context & Audit Trail:** `@McpContext()` inspects `openai/session` on incoming tool calls.
5. **Reimbursement Prompt:** `@McpPrompt('remind_debtor')` generates casual WhatsApp/Slack/Email payment reminders.

---

## Running Locally

```bash
# Start development server
pnpm dev

# Typecheck & Build
pnpm build
```
