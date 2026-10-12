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
# Start development server via runner script
./scripts/fork/run-local.sh --mcp-example splittab-nestjs

# Or run directly in package
pnpm dev
```

---

## Example Prompts to Trigger MCP Capabilities

Here are sample prompts you can send to your LLM / Inspector client to test and trigger SplitTab:

### 1. 📊 Consultation & Synthèse (`get_group_summary`)
- **FR :** *"Quel est le récapitulatif des dépenses du groupe weekend-alps ? Qui a payé quoi et quel est le solde de chacun ?"*
- **FR :** *"Fais-moi un bilan des comptes pour notre séjour aux Alpes."*
- **EN :** *"Can you give me a full summary of the weekend-alps group expenses? Who paid what?"*

### 2. ➕ Ajout d'une dépense (`add_expense`)
- **FR :** *"Ajoute une dépense de 60€ payée par Bob pour les forfaits de ski, partagée entre Alice, Bob et Charlie dans le groupe weekend-alps."*
- **FR :** *"Enregistre 35 EUR dépensés par Charlie pour le plein d'essence partagé à parts égales entre tout le monde."*
- **EN :** *"Alice just paid 45 EUR for pizzas split between Alice, Bob and Charlie. Can you record this in weekend-alps?"*

### 3. ⚖️ Équilibrage des dettes (`settle_debts`)
- **FR :** *"Comment peut-on régler toutes les dettes du groupe weekend-alps avec le minimum de virements possible ?"*
- **FR :** *"Calcule les remboursements optimaux pour remettre tous les comptes à zéro."*
- **EN :** *"What are the minimum transfers needed to settle all debts in weekend-alps?"*

### 4. 💬 Modèle de relance bienveillante (Prompt `remind_debtor`)
- **FR :** *"Rédige un message amical sur WhatsApp pour relancer Charlie qui doit 20€ à Alice pour les courses."*
- **EN :** *"Draft a gentle reminder for Bob who owes 35 EUR to Alice using a casual tone."*

### 5. 📑 Registre brut (Resource `splittab://groups/summary`)
- **FR/EN :** Demander au client de lire la ressource `splittab://groups/summary` pour inspecter l'état brut JSON du registre des dépenses.

