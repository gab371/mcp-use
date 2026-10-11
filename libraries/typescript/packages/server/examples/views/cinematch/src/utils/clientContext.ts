export interface ClientContextInfo {
  subject: string;
  sessionId: string;
  locale?: string | undefined;
}

export interface ToolInvocationContext {
  client?: {
    user?: (() => {
      subject?: string | undefined;
      conversationId?: string | undefined;
      locale?: string | undefined;
    } | undefined) | undefined;
  } | undefined;
}

/**
 * Extracts and logs ChatGPT client context headers from incoming MCP request metadata.
 * Uses mcp-use's ctx.client.user() which decodes openai/subject and openai/session.
 */
export function extractAndLogClientContext(
  ctx: ToolInvocationContext,
  action: string,
  extra?: Record<string, unknown>
): ClientContextInfo {
  const user = typeof ctx.client?.user === "function" ? ctx.client.user() : undefined;

  const subject = user?.subject || "user_anon_chatgpt";
  const sessionId = user?.conversationId || "session_default_chatgpt";
  const locale = user?.locale || "en-US";

  // Structured logging for auditability and observability
  const extraStr = extra ? ` | details=${JSON.stringify(extra)}` : "";
  console.log(
    `[CineMatch] [User: ${subject}] [Session: ${sessionId}] ${action}${extraStr}`
  );

  return { subject, sessionId, locale };
}
