import { describe, expect, it } from "vitest";
import { parseSuiteYaml } from "../../evals/engine/suite";

describe("parseSuiteYaml", () => {
  it("successfully parses a valid suite YAML", () => {
    const yaml = `
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
`;

    const result = parseSuiteYaml(yaml);
    expect(result.success).toBe(true);
    expect(result.suite?.name).toBe("Tool routing");
    expect(result.suite?.defaults?.iterations).toBe(3);
    expect(result.suite?.cases.length).toBe(3);
    expect(result.suite?.cases[0].id).toBe("discover-movies");
    expect(result.suite?.cases[0].prompts).toEqual([
      "Can you recommend a sci-fi movie under 2 hours for tonight?",
    ]);
  });

  it("normalizes a single prompt string into an array", () => {
    const yaml = `
name: Single prompt test
cases:
  - id: test-1
    prompts: "Hello world"
    expect:
      - toolCalled: greet
`;
    const result = parseSuiteYaml(yaml);
    expect(result.success).toBe(true);
    expect(result.suite?.cases[0].prompts).toEqual(["Hello world"]);
  });

  it("rejects unknown keys at root with clear errors", () => {
    const yaml = `
name: Test
unknownField: 123
cases:
  - id: test-1
    prompts: ["Hi"]
    expect:
      - toolCalled: test
`;
    const result = parseSuiteYaml(yaml);
    expect(result.success).toBe(false);
    expect(result.error).toContain("unknownField");
  });

  it("rejects unknown keys in cases with clear errors", () => {
    const yaml = `
name: Test
cases:
  - id: test-1
    bogusCaseKey: true
    prompts: ["Hi"]
    expect:
      - toolCalled: test
`;
    const result = parseSuiteYaml(yaml);
    expect(result.success).toBe(false);
    expect(result.error).toContain("bogusCaseKey");
  });

  it("rejects empty YAML content", () => {
    const result = parseSuiteYaml("");
    expect(result.success).toBe(false);
    expect(result.error).toContain("empty");
  });

  it("handles malformed YAML syntax gracefully", () => {
    const result = parseSuiteYaml("name: [unclosed array");
    expect(result.success).toBe(false);
    expect(result.error).toContain("YAML syntax error");
  });
});
