import { describe, expect, it, vi, beforeEach } from "vitest";
import type { JSONRPCMessage, Transport } from "@mcp-use/client/react";
import {
  wrapTransportWithHostMeta,
  setActiveToolCallMeta,
  getActiveToolCallMeta,
} from "../host-profiles/meta-transport";

describe("wrapTransportWithHostMeta", () => {
  let fakeSend: ReturnType<typeof vi.fn>;
  let transport: Transport;

  beforeEach(() => {
    setActiveToolCallMeta(undefined);
    fakeSend = vi.fn().mockResolvedValue(undefined);
    transport = {
      sessionId: "session-123",
      start: vi.fn().mockResolvedValue(undefined),
      send: fakeSend,
      close: vi.fn().mockResolvedValue(undefined),
      onclose: undefined,
      onerror: undefined,
      onmessage: undefined,
    };
  });

  it("injects active host profile _meta on tools/call requests", async () => {
    setActiveToolCallMeta({
      "openai/subject": "user_123",
      "openai/session": "sess_abc",
      "openai/locale": "en-US",
    });

    const wrapped = wrapTransportWithHostMeta(transport);

    const callMessage: JSONRPCMessage = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "test_tool",
        arguments: { arg1: "val1" },
      },
    } as any;

    await wrapped.send(callMessage);

    expect(fakeSend).toHaveBeenCalledTimes(1);
    const sentMessage = fakeSend.mock.calls[0][0];
    expect(sentMessage.params._meta).toEqual({
      "openai/subject": "user_123",
      "openai/session": "sess_abc",
      "openai/locale": "en-US",
    });
  });

  it("preserves progressToken and merges with active _meta", async () => {
    setActiveToolCallMeta({
      "openai/subject": "user_123",
      "openai/session": "sess_abc",
    });

    const wrapped = wrapTransportWithHostMeta(transport);

    const callMessage: JSONRPCMessage = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "long_tool",
        arguments: {},
        _meta: {
          progressToken: 42,
        },
      },
    } as any;

    await wrapped.send(callMessage);

    const sentMessage = fakeSend.mock.calls[0][0];
    expect(sentMessage.params._meta).toEqual({
      "openai/subject": "user_123",
      "openai/session": "sess_abc",
      progressToken: 42,
    });
  });

  it("prioritizes caller/widget _meta over default host profile _meta", async () => {
    setActiveToolCallMeta({
      "openai/subject": "default_user",
      "openai/session": "default_sess",
      "openai/locale": "en-US",
    });

    const wrapped = wrapTransportWithHostMeta(transport);

    const callMessage: JSONRPCMessage = {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "widget_tool",
        arguments: {},
        _meta: {
          "openai/subject": "override_user",
          customField: "customVal",
        },
      },
    } as any;

    await wrapped.send(callMessage);

    const sentMessage = fakeSend.mock.calls[0][0];
    expect(sentMessage.params._meta).toEqual({
      "openai/subject": "override_user",
      "openai/session": "default_sess",
      "openai/locale": "en-US",
      customField: "customVal",
    });
  });

  it("does not modify message when active meta is empty (e.g. mcp-use profile)", async () => {
    setActiveToolCallMeta(undefined);

    const wrapped = wrapTransportWithHostMeta(transport);

    const callMessage: JSONRPCMessage = {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "plain_tool",
        arguments: {},
      },
    } as any;

    await wrapped.send(callMessage);

    const sentMessage = fakeSend.mock.calls[0][0];
    expect(sentMessage.params._meta).toBeUndefined();
    expect(sentMessage).toEqual(callMessage);
  });

  it("leaves non-tools/call messages untouched even when active meta is set", async () => {
    setActiveToolCallMeta({
      "openai/subject": "user_123",
      "openai/session": "sess_abc",
    });

    const wrapped = wrapTransportWithHostMeta(transport);

    const initMessage: JSONRPCMessage = {
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0.0" },
      },
    } as any;

    await wrapped.send(initMessage);

    const sentMessage = fakeSend.mock.calls[0][0];
    expect(sentMessage).toEqual(initMessage);
    expect(sentMessage.params._meta).toBeUndefined();
  });
});
