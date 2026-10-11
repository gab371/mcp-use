import {
  Inject,
  Injectable,
  Logger,
  type NestMiddleware,
} from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { MCPServer } from 'mcp-use';
import { toNodeHandler } from 'mcp-use/node';
import { MCP_MODULE_OPTIONS, MCP_SERVER_TOKEN } from '../constants.js';
import type { McpModuleOptions } from '../interfaces/mcp-module-options.js';

@Injectable()
export class McpMiddleware implements NestMiddleware {
  private readonly logger = new Logger('McpMiddleware');
  private readonly nodeHandler: (
    req: IncomingMessage,
    res: ServerResponse,
    parsedBody?: unknown
  ) => Promise<void>;
  private inspectorHandler:
    | ((
        req: IncomingMessage,
        res: ServerResponse,
        parsedBody?: unknown
      ) => Promise<void>)
    | null = null;
  private inspectorInitPromise: Promise<void> | null = null;

  constructor(
    @Inject(MCP_SERVER_TOKEN)
    private readonly server: MCPServer,
    @Inject(MCP_MODULE_OPTIONS)
    private readonly options: McpModuleOptions
  ) {
    this.nodeHandler = toNodeHandler({ fetch: this.server.fetch });
    if (this.options.inspector) {
      this.inspectorInitPromise = this.initInspector();
    }
  }

  private async initInspector(): Promise<void> {
    try {
      // Dynamic import to avoid hard dependency on @mcp-use/inspector in production
      const inspectorMod = await import('@mcp-use/inspector');
      if (typeof inspectorMod.mountInspector === 'function') {
        const inspectorOpts =
          typeof this.options.inspector === 'object'
            ? this.options.inspector
            : {};
        const basePath = (this.options.basePath ?? '/mcp').replace(/\/+$/, '');
        const inspectorFetch = inspectorMod.mountInspector({
          basePath: `${basePath}/inspector`,
          autoConnectUrl: `http://localhost:3000${basePath}`,
          ...inspectorOpts,
        });
        this.inspectorHandler = toNodeHandler({ fetch: inspectorFetch });
        this.logger.log(`Embedded Inspector mounted at ${basePath}/inspector`);
      }
    } catch {
      this.logger.warn(
        'Embedded Inspector was requested in McpModuleOptions, but @mcp-use/inspector is not installed. To use it, add @mcp-use/inspector to your devDependencies.'
      );
    }
  }

  async use(
    req: IncomingMessage & { originalUrl?: string; body?: unknown },
    res: ServerResponse,
    next: (error?: any) => void
  ): Promise<void> {
    const basePath = (this.options.basePath ?? '/mcp').replace(/\/+$/, '');
    const url = req.originalUrl || req.url || '';
    const pathname = url.split('?')[0];

    // Wait for inspector initialization if in-flight
    if (this.inspectorInitPromise) {
      await this.inspectorInitPromise;
    }

    // 1. Check if matching Inspector route
    if (
      this.inspectorHandler &&
      (pathname === `${basePath}/inspector` ||
        pathname.startsWith(`${basePath}/inspector/`))
    ) {
      if (req.originalUrl) {
        req.url = req.originalUrl;
      }
      await this.inspectorHandler(req, res, req.body);
      return;
    }

    // 2. Check if matching MCP Server route (explicit basePath or root fallback)
    const isMcpRoute = pathname === basePath || pathname.startsWith(`${basePath}/`);
    const isRootMcpFallback = pathname === '/' && (
      req.method === 'POST' ||
      req.method === 'OPTIONS' ||
      req.method === 'GET'
    );

    if (isMcpRoute || isRootMcpFallback) {
      if (isRootMcpFallback) {
        req.url = `${basePath}${req.url === '/' ? '' : req.url}`;
      } else if (req.originalUrl) {
        req.url = req.originalUrl;
      }
      await this.nodeHandler(req, res, req.body);
      return;
    }

    // 3. Fallback to normal NestJS pipeline
    next();
  }
}
