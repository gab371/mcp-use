import type { Provider } from '@nestjs/common';
import { MCPServer } from 'mcp-use';
import { MCP_MODULE_OPTIONS, MCP_SERVER_TOKEN } from '../constants.js';
import type { McpModuleOptions } from '../interfaces/mcp-module-options.js';

export const McpServerProvider: Provider = {
  provide: MCP_SERVER_TOKEN,
  useFactory: (options: McpModuleOptions): MCPServer => {
    return new MCPServer({
      name: options.name ?? 'nestjs-mcp',
      version: options.version ?? '1.0.0',
      description: options.description,
      ...(options.serverOptions ?? {}),
    });
  },
  inject: [MCP_MODULE_OPTIONS],
};
