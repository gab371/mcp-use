import { MCPAgent, providerConfigFromOptions, type McpConnectionLike } from "@mcp-use/agent";
import { isToolVisibleToModel } from "./tool-visibility";
import type { EvalCase, EvalSuiteDefaults } from "./suite";
import type { ToolCallRecord, Transcript } from "./checks";

export interface LlmRunConfig {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  credentials?: Record<string, unknown>;
  temperature?: number;
}

export interface RunCaseOptions {
  signal?: AbortSignal;
  runId?: string;
  timeoutMs?: number;
  resolvedGolden?: Record<string, string>;
}

/**
 * Runs a single evaluation case using MCPAgent against the MCP server connection.
 */
export async function runCase(
  caseDef: EvalCase,
  connection: McpConnectionLike,
  llmConfig: LlmRunConfig,
  suiteDefaults?: EvalSuiteDefaults,
  options: RunCaseOptions = {}
): Promise<Transcript> {
  const startTime = Date.now();
  const toolCalls: ToolCallRecord[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let finalText = "";

  // 1. Filter tools invisible to the model (e.g. app-only tools with _meta.ui.visibility: ["app"])
  const disallowedTools: string[] = [];
  if (connection.tools && Array.isArray(connection.tools)) {
    for (const tool of connection.tools) {
      if (!isToolVisibleToModel(tool)) {
        disallowedTools.push(tool.name);
      }
    }
  }

  // 2. Wrap connection to accurately capture tool calls and timings
  const wrappedConnection: McpConnectionLike = {
    ...connection,
    tools: connection.tools,
    callTool: async (toolName, args, callOpts) => {
      const callStart = Date.now();
      const record: ToolCallRecord = {
        name: toolName,
        args: args ? JSON.parse(JSON.stringify(args)) : {},
        startedAt: callStart,
        endedAt: callStart,
      };
      toolCalls.push(record);

      try {
        const result = await connection.callTool(toolName, args, callOpts);
        record.endedAt = Date.now();
        record.result = result;
        record.isError =
          typeof result === "object" && result !== null && (result as { isError?: boolean }).isError === true;
        return result;
      } catch (err: unknown) {
        record.endedAt = Date.now();
        record.result = err instanceof Error ? { message: err.message } : err;
        record.isError = true;
        throw err;
      }
    },
  };

  // 3. Resolve configuration
  const temperature =
    caseDef.temperature ?? suiteDefaults?.temperature ?? llmConfig.temperature ?? 0;
  const maxSteps = caseDef.maxSteps ?? suiteDefaults?.maxSteps ?? 5;
  const systemPrompt = caseDef.systemPrompt ?? suiteDefaults?.systemPrompt ?? "";
  const timeoutMs = caseDef.timeoutMs ?? suiteDefaults?.timeoutMs ?? options.timeoutMs ?? 60000;

  // Timeout controller
  const abortController = new AbortController();
  const timeoutTimer = setTimeout(() => {
    abortController.abort(new Error(`Eval case timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  const onUserAbort = () => {
    abortController.abort(options.signal?.reason);
  };
  if (options.signal) {
    if (options.signal.aborted) {
      abortController.abort(options.signal.reason);
    } else {
      options.signal.addEventListener("abort", onUserAbort, { once: true });
    }
  }

  try {
    const providerConfig = providerConfigFromOptions(llmConfig.provider, llmConfig.model, {
      apiKey: llmConfig.apiKey,
      temperature,
      baseUrl: llmConfig.baseUrl,
      credentials: llmConfig.credentials,
    });

    const agent = new MCPAgent({
      llm: providerConfig,
      mcpServers: [wrappedConnection],
      systemPrompt: systemPrompt || undefined,
      disallowedTools: disallowedTools.length > 0 ? disallowedTools.sort() : undefined,
      maxSteps: Math.min(100, Math.max(1, Math.trunc(maxSteps))),
      autoInitialize: true,
    });

    // Multi-turn conversation support across caseDef.prompts
    const conversationMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

    const effectivePrompts: string[] = [];
    if (caseDef.prompts && caseDef.prompts.length > 0) {
      effectivePrompts.push(...caseDef.prompts);
    } else if (caseDef.promptFile && options.resolvedGolden?.[caseDef.promptFile]) {
      effectivePrompts.push(options.resolvedGolden[caseDef.promptFile]);
    }

    if (effectivePrompts.length === 0) {
      throw new Error(
        `Case "${caseDef.id}" has no executable prompts (promptFile "${caseDef.promptFile || ""}" could not be resolved)`
      );
    }

    for (const prompt of effectivePrompts) {
      if (abortController.signal.aborted) break;

      conversationMessages.push({ role: "user", content: prompt });
      let turnText = "";

      for await (const event of agent.streamEvents({
        messages: conversationMessages,
        signal: abortController.signal,
      })) {
        if (abortController.signal.aborted) break;

        const ev = event as { type: string; delta?: string; usage?: { inputTokens?: number; outputTokens?: number } };
        if (ev.type === "text-delta" && ev.delta) {
          turnText += ev.delta;
        } else if (ev.type === "usage" && ev.usage) {
          totalInputTokens += ev.usage.inputTokens ?? 0;
          totalOutputTokens += ev.usage.outputTokens ?? 0;
        }
      }

      conversationMessages.push({ role: "assistant", content: turnText });
      finalText = turnText;
    }

    clearTimeout(timeoutTimer);
    if (options.signal) {
      options.signal.removeEventListener("abort", onUserAbort);
    }

    return {
      toolCalls,
      finalText,
      durationMs: Date.now() - startTime,
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
      },
    };
  } catch (err: unknown) {
    clearTimeout(timeoutTimer);
    if (options.signal) {
      options.signal.removeEventListener("abort", onUserAbort);
    }

    const message = err instanceof Error ? err.message : String(err);
    return {
      toolCalls,
      finalText,
      durationMs: Date.now() - startTime,
      error: message,
      isInconclusive: true,
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
      },
    };
  }
}
