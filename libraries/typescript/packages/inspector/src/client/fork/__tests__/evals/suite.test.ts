import { describe, expect, it } from "vitest";
import { parseSuiteYaml, addExpectationToSuiteYaml } from "../../evals/engine/suite";

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

  it("successfully parses suite with promptFile, goldenResult, and goldenAnswer", () => {
    const yaml = `
name: Golden Tests
cases:
  - id: golden-case-1
    promptFile: golden/kids-prompt.md
    expect:
      - goldenResult:
          tool: explorer
          file: golden/kids.result.json
          match: partial
      - goldenAnswer:
          file: golden/kids.answer.md
          match: similarity
          threshold: 0.75
`;
    const result = parseSuiteYaml(yaml);
    expect(result.success).toBe(true);
    expect(result.suite?.cases[0].promptFile).toBe("golden/kids-prompt.md");
    expect(result.suite?.cases[0].expect[0].goldenResult?.tool).toBe("explorer");
    expect(result.suite?.cases[0].expect[0].goldenResult?.match).toBe("partial");
    expect(result.suite?.cases[0].expect[1].goldenAnswer?.threshold).toBe(0.75);
  });

  it("rejects case missing both prompts and promptFile", () => {
    const yaml = `
name: Missing Prompts
cases:
  - id: bad-case
    expect:
      - noToolError: true
`;
    const result = parseSuiteYaml(yaml);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Case must have either prompts or promptFile defined");
  });
});

describe("addExpectationToSuiteYaml", () => {
  it("injects a goldenResult expectation to an existing case", () => {
    const yaml = `name: Test Suite
cases:
  - id: sample-case
    prompts:
      - Hello
    expect:
      - toolCalled: get_movie_details
`;
    const updated = addExpectationToSuiteYaml(yaml, "sample-case", {
      goldenResult: {
        tool: "get_movie_details",
        file: "golden/movie-details.result.json",
        match: "partial",
      },
    });
    const parsed = parseSuiteYaml(updated);
    expect(parsed.success).toBe(true);
    expect(parsed.suite?.cases[0].expect.length).toBe(2);
    expect(parsed.suite?.cases[0].expect[1].goldenResult?.file).toBe(
      "golden/movie-details.result.json"
    );
  });

  it("injects a goldenAnswer expectation to an existing case", () => {
    const yaml = `name: Test Suite
cases:
  - id: sample-case
    prompts:
      - Hello
    expect:
      - toolCalled: get_movie_details
`;
    const updated = addExpectationToSuiteYaml(yaml, "sample-case", {
      goldenAnswer: {
        file: "golden/answer.md",
        match: "similarity",
        threshold: 0.75,
      },
    });
    const parsed = parseSuiteYaml(updated);
    expect(parsed.success).toBe(true);
    expect(parsed.suite?.cases[0].expect.length).toBe(2);
    expect(parsed.suite?.cases[0].expect[1].goldenAnswer?.file).toBe("golden/answer.md");
  });
});

