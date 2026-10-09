import type { JSONRPCMessage, Transport } from "@mcp-use/client/react";

let activeToolCallMeta: Record<string, unknown> | undefined;

export function setActiveToolCallMeta(
  meta: Record<string, unknown> | undefined
): void {
  activeToolCallMeta = meta;
}

export function getActiveToolCallMeta(): Record<string, unknown> | undefined {
  return activeToolCallMeta;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Wrap a transport to inject active host profile client metadata (_meta)
 * into all outgoing tools/call JSON-RPC messages.
 */
export function wrapTransportWithHostMeta(transport: Transport): Transport {
  const originalSend = transport.send.bind(transport);

  transport.send = async (message: JSONRPCMessage, options?: unknown) => {
    let outgoingMessage = message;

    if (
      isRecord(outgoingMessage) &&
      outgoingMessage.method === "tools/call"
    ) {
      const meta = getActiveToolCallMeta();
      if (meta && Object.keys(meta).length > 0) {
        const params = isRecord(outgoingMessage.params)
          ? outgoingMessage.params
          : {};
        const existingMeta = isRecord(params._meta) ? params._meta : {};

        outgoingMessage = {
          ...outgoingMessage,
          params: {
            ...params,
            _meta: {
              ...meta,
              ...existingMeta,
            },
          },
        } as JSONRPCMessage;
      }
    }

    return originalSend(outgoingMessage, options);
  };

  return transport;
}
