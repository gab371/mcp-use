import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROBE_WIDGET_HTML = fs.readFileSync(
  path.join(__dirname, "probe-widget.html"),
  "utf8"
);

export const PROBE_RESOURCE_URI = "ui://probe/index.html";

export function handleProbeRpc(method: string, params: any) {
  if (method === "tools/list") {
    return {
      tools: [
        {
          name: "show_probe",
          description:
            "Show the MCP Apps Host Probe widget to inspect hostInfo, hostContext and globals",
          inputSchema: {
            type: "object",
            properties: {},
          },
          _meta: {
            ui: {
              resourceUri: PROBE_RESOURCE_URI,
            },
          },
        },
      ],
    };
  }

  if (method === "tools/call") {
    if (params?.name === "show_probe") {
      return {
        content: [
          {
            type: "text",
            text: `MCP Apps Host Probe widget loaded. ${
              params?._meta
                ? `Received client _meta (${Object.keys(params._meta).length} keys).`
                : "No client _meta received."
            }`,
          },
        ],
        structuredContent: {
          receivedMeta: params?._meta ?? null,
          calledTool: params?.name,
        },
        _meta: {
          ui: {
            resourceUri: PROBE_RESOURCE_URI,
          },
        },
      };
    }
    throw new Error(`Unknown tool: ${params?.name}`);
  }

  if (method === "resources/list") {
    return {
      resources: [
        {
          uri: PROBE_RESOURCE_URI,
          name: "MCP Apps Host Probe",
          mimeType: "text/html;profile=mcp-app",
        },
      ],
    };
  }

  if (method === "resources/read") {
    if (params?.uri === PROBE_RESOURCE_URI) {
      return {
        contents: [
          {
            uri: PROBE_RESOURCE_URI,
            mimeType: "text/html;profile=mcp-app",
            text: PROBE_WIDGET_HTML,
          },
        ],
      };
    }
    throw new Error(`Unknown resource: ${params?.uri}`);
  }

  return null;
}
