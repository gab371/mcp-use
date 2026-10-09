import { describe, expect, it, vi } from "vitest";

const callToolMock = vi.fn();

vi.mock("@modelcontextprotocol/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@modelcontextprotocol/client")>();

  class MockClient {
    _notificationHandlers = new Map();
    setRequestHandler() {}
    async connect(): Promise<void> {}
    async close(): Promise<void> {}
    async callTool(params: any, options: any) {
      callToolMock(params, options);
      return { content: [{ type: "text", text: "OK" }] };
    }
  }

  class MockStreamableHTTPClientTransport {
    sessionId = "test-session";
    async close(): Promise<void> {}
    async terminateSession(): Promise<void> {}
  }

  return {
    ...actual,
    Client: MockClient,
    StreamableHTTPClientTransport: MockStreamableHTTPClientTransport,
  };
});

import { HttpConnector } from "../../../src/transport/http.js";

class TestHttpConnector extends HttpConnector {
  protected trackConnectorInit(): void {}
}

describe("BaseConnector & HttpConnector tool call _meta and header sync", () => {
  it("forwards _meta to client.callTool and syncs OpenAI headers to transport headers", async () => {
    const connector = new TestHttpConnector("http://localhost:3000/mcp", {
      timeout: 10,
    });
    await connector.connect();

    const clientMeta = {
      "openai/subject": "user_123",
      "openai/session": "sess_456",
      "openai/organization": "org_789",
      "openai/locale": "fr-FR",
    };

    const result = await connector.callTool(
      "test_tool",
      { query: "hello" },
      { _meta: clientMeta } as any
    );

    expect(result).toEqual({ content: [{ type: "text", text: "OK" }] });

    // Verify client.callTool was called with _meta in params
    expect(callToolMock).toHaveBeenCalledWith(
      {
        name: "test_tool",
        arguments: { query: "hello" },
        _meta: clientMeta,
      },
      expect.anything()
    );

    // Verify HTTP headers were synced onto transport
    const headers = (connector as any).headers;
    expect(headers["X-OpenAI-Subject"]).toBe("user_123");
    expect(headers["X-OpenAI-Session"]).toBe("sess_456");
    expect(headers["X-OpenAI-Organization"]).toBe("org_789");
    expect(headers["X-OpenAI-Locale"]).toBe("fr-FR");

    await connector.disconnect();
  });
});
