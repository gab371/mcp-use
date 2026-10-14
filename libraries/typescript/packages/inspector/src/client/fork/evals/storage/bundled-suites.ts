export interface BundledSuite {
  id: string;
  name: string;
  rawYaml: string;
  goldenFiles?: Record<string, string>;
}

export const BUNDLED_SUITES: BundledSuite[] = [
  {
    id: "tool-routing",
    name: "Tool routing",
    rawYaml: `# Reference suite (tool routing).
name: Tool routing
defaults:
  iterations: 3
  passThreshold: 0.67
  temperature: 0
  maxSteps: 5
cases:
  - id: discover-movies
    prompts:
      - Can you recommend a sci-fi movie under 2 hours for tonight?
    expect:
      - toolCalled: discover_movies
        args: { genre: any-string, maxRuntimeMinutes: any-number }
      - onlyTools: [discover_movies]

  - id: family-recipes
    prompts:
      - Can you suggest fun and easy recipes to cook as a family with my kids?
    expect:
      - firstTool: recipe_finder
      - toolNotCalled: professional_chef_database
      - toolNotCalled: bulk_catering_orders

  - id: no-personal-data
    prompts:
      - My name is Jane Doe, reservation HTL-98765, what time is check-in at the hotel?
    expect:
      - toolCalled: faq
      - argsNeverContain: ["Jane", "Doe", "HTL-98765"]
`,
  },
  {
    id: "splittab/expenses/expenses",
    name: "SplitTab Expense & Settlement Evals",
    rawYaml: `name: SplitTab Expense & Settlement Evals
defaults:
  iterations: 3
  passThreshold: 0.67
  temperature: 0
  maxSteps: 5
cases:
  - id: add-expense
    prompts:
      - Alice just paid 45 EUR for pizzas split between Alice, Bob and Charlie. Can you record this in weekend-alps?
      - Ajoute une dépense de 60€ payée par Bob pour les forfaits de ski partagée entre Alice, Bob et Charlie dans weekend-alps.
    expect:
      - toolCalled: add_expense
        args: { amount: any-number }

  - id: get-group-summary
    prompts:
      - How much did we spend in total during our weekend in the Alps? Who paid what?
      - Quel est le récapitulatif des dépenses du groupe weekend-alps ? Qui a payé quoi ?
    expect:
      - toolCalled: get_group_summary

  - id: settle-debts
    prompts:
      - What are the minimum transfers needed to settle all debts in weekend-alps?
      - Comment équilibrer les comptes du groupe weekend-alps avec le minimum de virements ?
    expect:
      - toolCalled: settle_debts
`,
  },
];
