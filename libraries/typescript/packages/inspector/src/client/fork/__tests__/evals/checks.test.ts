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

  it("11. goldenResult (partial, exact, and text unwrapping)", () => {
    const transcriptWithTool: Transcript = {
      toolCalls: [
        {
          name: "explorer",
          args: {},
          result: {
            items: [{ name: "Sky Adventure", id: 101, extra: "foo" }],
            status: "ok",
          },
          isError: false,
        },
      ],
      finalText: "Done",
    };

    // Partial match succeeds on subset
    expect(
      evaluateCheck(
        {
          goldenResult: {
            tool: "explorer",
            content: { items: [{ name: "Sky Adventure" }] },
            match: "partial",
          },
        },
        transcriptWithTool
      ).pass
    ).toBe(true);

    // Exact match fails because of extra fields
    expect(
      evaluateCheck(
        {
          goldenResult: {
            tool: "explorer",
            content: { items: [{ name: "Sky Adventure" }] },
            match: "exact",
          },
        },
        transcriptWithTool
      ).pass
    ).toBe(false);

    // Resolving via golden file map
    const resolvedGolden = {
      "golden/explorer.result.json": JSON.stringify({ items: [{ name: "Sky Adventure" }] }),
    };
    expect(
      evaluateCheck(
        {
          goldenResult: {
            tool: "explorer",
            file: "golden/explorer.result.json",
            match: "partial",
          },
        },
        transcriptWithTool,
        resolvedGolden
      ).pass
    ).toBe(true);

    // MCP content[0].text JSON unwrapping
    const transcriptMcpContent: Transcript = {
      toolCalls: [
        {
          name: "explorer",
          args: {},
          result: { content: [{ type: "text", text: '{"status":"active","count":42}' }] },
          isError: false,
        },
      ],
      finalText: "Done",
    };

    expect(
      evaluateCheck(
        {
          goldenResult: {
            tool: "explorer",
            content: { status: "active" },
            match: "partial",
          },
        },
        transcriptMcpContent
      ).pass
    ).toBe(true);

    // Multi-part content with plain text summary followed by serialized JSON
    const transcriptMultiPart: Transcript = {
      toolCalls: [
        {
          name: "explorer",
          args: {},
          result: {
            _meta: { ui: { resourceUri: "ui://widget.html" } },
            content: [
              { type: "text", text: "Found 42 results (market: en-gb)." },
              { type: "text", text: '{"market":"en-gb","items":[{"id":"A1","name":"Ride"}]}' },
            ],
          },
          isError: false,
        },
      ],
      finalText: "Done",
    };

    // Matches against the serialized JSON inside content[1]
    expect(
      evaluateCheck(
        {
          goldenResult: {
            tool: "explorer",
            content: { items: [{ id: "A1" }] },
            match: "partial",
          },
        },
        transcriptMultiPart
      ).pass
    ).toBe(true);

    // Matches against root _meta
    expect(
      evaluateCheck(
        {
          goldenResult: {
            tool: "explorer",
            content: { _meta: { ui: { resourceUri: "ui://widget.html" } } },
            match: "partial",
          },
        },
        transcriptMultiPart
      ).pass
    ).toBe(true);

    // When matching fails against an object, reason should be informative and not "Expected object, got string"
    const failedCheck = evaluateCheck(
      {
        goldenResult: {
          tool: "explorer",
          content: { _meta: { missing: true } },
          match: "partial",
        },
      },
      transcriptMultiPart
    );
    expect(failedCheck.pass).toBe(false);
    expect(failedCheck.reason).toContain('Missing key "missing"');
    expect(failedCheck.reason).not.toContain("Expected object, got string");

    // Golden result matching tool result with structuredContent
    const transcriptStructured: Transcript = {
      toolCalls: [
        {
          name: "get_movie_details",
          args: { id: "inception" },
          result: {
            content: [{ type: "text", text: "### Inception (2010)\nSome markdown..." }],
            structuredContent: {
              found: true,
              movie: {
                id: "inception",
                title: "Inception",
                year: 2010,
              },
            },
          },
          isError: false,
        },
      ],
      finalText: "Done",
    };

    expect(
      evaluateCheck(
        {
          goldenResult: {
            tool: "get_movie_details",
            content: {
              found: true,
              movie: { id: "inception", title: "Inception" },
            },
            match: "partial",
          },
        },
        transcriptStructured
      ).pass
    ).toBe(true);

    // Golden result with any-uuid wildcard
    const transcriptUuid: Transcript = {
      toolCalls: [
        {
          name: "explorer",
          args: {},
          result: {
            _meta: {
              analytics: {
                id: "d7c79801-c89b-41a3-a29d-31029cb10290",
                tool: "explorer",
              },
            },
          },
          isError: false,
        },
      ],
      finalText: "Done",
    };

    expect(
      evaluateCheck(
        {
          goldenResult: {
            tool: "explorer",
            content: {
              _meta: {
                analytics: {
                  id: "any-uuid",
                  tool: "explorer",
                },
              },
            },
            match: "partial",
          },
        },
        transcriptUuid
      ).pass
    ).toBe(true);

    // Fails if expected uuid is not valid uuid format
    const transcriptBadUuid: Transcript = {
      toolCalls: [
        {
          name: "explorer",
          args: {},
          result: { _meta: { analytics: { id: "not-a-uuid" } } },
          isError: false,
        },
      ],
      finalText: "Done",
    };
    expect(
      evaluateCheck(
        {
          goldenResult: {
            tool: "explorer",
            content: { _meta: { analytics: { id: "any-uuid" } } },
            match: "partial",
          },
        },
        transcriptBadUuid
      ).pass
    ).toBe(false);
  });

  it("12. goldenAnswer (similarity and text matching)", () => {
    const transcript: Transcript = {
      toolCalls: [],
      finalText: "Sky Adventure and Cloud Ride are wonderful attractions for young children in Wonderland.",
    };

    // Similarity threshold
    const goldenMd = "Sky Adventure and Cloud Ride are great attractions for young kids in Wonderland.";
    const checkSim = evaluateCheck(
      {
        goldenAnswer: {
          text: goldenMd,
          match: "similarity",
          threshold: 0.5,
        },
      },
      transcript
    );
    expect(checkSim.pass).toBe(true);
    expect(checkSim.score).toBeGreaterThan(0.5);

    // High threshold failure
    const checkSimStrict = evaluateCheck(
      {
        goldenAnswer: {
          text: "Completely unrelated content about rocket ships in space.",
          match: "similarity",
          threshold: 0.5,
        },
      },
      transcript
    );
    expect(checkSimStrict.pass).toBe(false);

    // Contains
    expect(
      evaluateCheck(
        {
          goldenAnswer: {
            text: "Sky Adventure",
            match: "contains",
          },
        },
        transcript
      ).pass
    ).toBe(true);

    // Resolving via golden file map
    const resolvedGolden = {
      "golden/answer.md": goldenMd,
    };
    expect(
      evaluateCheck(
        {
          goldenAnswer: {
            file: "golden/answer.md",
            match: "similarity",
            threshold: 0.5,
          },
        },
        transcript,
        resolvedGolden
      ).pass
    ).toBe(true);
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
