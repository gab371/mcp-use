import { describe, expect, it } from "vitest";
import { evaluateCheck, evaluateAllChecks, type Transcript } from "../../evals/engine/checks";

describe("evaluateCheck (all 10 checks from checks.md)", () => {
  const baseTranscript: Transcript = {
    toolCalls: [
      {
        name: "entity_search",
        args: { query: "hotel", market: "fr" },
        result: { count: 3 },
        isError: false,
      },
      {
        name: "explorer",
        args: { id: 101, details: true },
        result: { found: true },
        isError: false,
      },
    ],
    finalText: "Here is your ticket for tickets.example.com costing 120 €.",
  };

  it("1. toolCalled (simple and with args partial/exact/wildcards)", () => {
    // simple
    expect(evaluateCheck({ toolCalled: "entity_search" }, baseTranscript).pass).toBe(true);
    expect(evaluateCheck({ toolCalled: "missing_tool" }, baseTranscript).pass).toBe(false);

    // with partial args (default)
    expect(
      evaluateCheck(
        { toolCalled: "entity_search", args: { market: "fr" } },
        baseTranscript
      ).pass
    ).toBe(true);

    // with wildcards: any-string, any-number
    expect(
      evaluateCheck(
        { toolCalled: "explorer", args: { id: "any-number", details: "any" } },
        baseTranscript
      ).pass
    ).toBe(true);

    // with exact match (should fail because explorer has details: true)
    expect(
      evaluateCheck(
        { toolCalled: "explorer", args: { id: 101 }, match: "exact" },
        baseTranscript
      ).pass
    ).toBe(false);

    // with exact match matching all
    expect(
      evaluateCheck(
        { toolCalled: "explorer", args: { id: 101, details: true }, match: "exact" },
        baseTranscript
      ).pass
    ).toBe(true);
  });

  it("2. toolNotCalled", () => {
    expect(evaluateCheck({ toolNotCalled: "media_data" }, baseTranscript).pass).toBe(true);
    expect(evaluateCheck({ toolNotCalled: "explorer" }, baseTranscript).pass).toBe(false);
  });

  it("3. onlyTools", () => {
    expect(
      evaluateCheck({ onlyTools: ["entity_search", "explorer", "faq"] }, baseTranscript).pass
    ).toBe(true);
    expect(evaluateCheck({ onlyTools: ["entity_search"] }, baseTranscript).pass).toBe(false);

    // empty array expects no tools at all
    const emptyTranscript: Transcript = { toolCalls: [], finalText: "None" };
    expect(evaluateCheck({ onlyTools: [] }, emptyTranscript).pass).toBe(true);
    expect(evaluateCheck({ onlyTools: [] }, baseTranscript).pass).toBe(false);
  });

  it("4. firstTool", () => {
    expect(evaluateCheck({ firstTool: "entity_search" }, baseTranscript).pass).toBe(true);
    expect(evaluateCheck({ firstTool: "explorer" }, baseTranscript).pass).toBe(false);
  });

  it("5. toolOrder", () => {
    expect(evaluateCheck({ toolOrder: ["entity_search", "explorer"] }, baseTranscript).pass).toBe(
      true
    );
    expect(evaluateCheck({ toolOrder: ["explorer", "entity_search"] }, baseTranscript).pass).toBe(
      false
    );
  });

  it("6. maxToolCalls", () => {
    expect(evaluateCheck({ maxToolCalls: 2 }, baseTranscript).pass).toBe(true);
    expect(evaluateCheck({ maxToolCalls: 3 }, baseTranscript).pass).toBe(true);
    expect(evaluateCheck({ maxToolCalls: 1 }, baseTranscript).pass).toBe(false);
  });

  it("7. noToolError", () => {
    expect(evaluateCheck({ noToolError: true }, baseTranscript).pass).toBe(true);

    const errorTranscript: Transcript = {
      toolCalls: [{ name: "broken", args: {}, result: "Failed", isError: true }],
      finalText: "Sorry",
    };
    expect(evaluateCheck({ noToolError: true }, errorTranscript).pass).toBe(false);
  });

  it("8. argsNeverContain", () => {
    expect(evaluateCheck({ argsNeverContain: ["Jane", "secret"] }, baseTranscript).pass).toBe(true);
    expect(evaluateCheck({ argsNeverContain: ["Hotel"] }, baseTranscript).pass).toBe(false); // case-insensitive match on "hotel"
  });

  it("9. answerContains", () => {
    expect(
      evaluateCheck({ answerContains: "tickets.example.com" }, baseTranscript).pass
    ).toBe(true);
    expect(evaluateCheck({ answerContains: "universal" }, baseTranscript).pass).toBe(false);
  });

  it("10. answerMatches", () => {
    expect(evaluateCheck({ answerMatches: "\\d+ ?€" }, baseTranscript).pass).toBe(true);
    expect(evaluateCheck({ answerMatches: "\\$120" }, baseTranscript).pass).toBe(false);
  });

  it("evaluateAllChecks aggregates passed and failed checks", () => {
    const { passed, failedChecks } = evaluateAllChecks(
      [
        { toolCalled: "entity_search" },
        { toolNotCalled: "missing_tool" },
        { toolCalled: "non_existent" },
      ],
      baseTranscript
    );
    expect(passed).toBe(false);
    expect(failedChecks.length).toBe(1);
    expect(failedChecks[0].checkName).toBe("toolCalled: non_existent");
  });
});
