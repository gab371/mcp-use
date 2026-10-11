declare module 'mcp-use' {
  export interface MCPServerOptions {
    name: string;
    version?: string;
    description?: string;
    [key: string]: any;
  }

  export class MCPServer {
    constructor(options: MCPServerOptions);
    name: string;
    version: string;
    fetch: (request: Request, extra?: any) => Promise<Response>;
    tool(definition: any, handler: any): any;
    resource(definition: any, handler: any): any;
    prompt(definition: any, handler: any): any;
    [key: string]: any;
  }
}

declare module 'mcp-use/node' {
  import type { IncomingMessage, ServerResponse } from 'node:http';

  export interface FetchLikeHandler {
    fetch: (request: Request, extra?: any) => Promise<Response>;
  }

  export function toNodeHandler(
    handler: FetchLikeHandler,
    opts?: any
  ): (
    req: IncomingMessage,
    res: ServerResponse,
    parsedBody?: unknown
  ) => Promise<void>;
}
