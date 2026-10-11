import { Injectable } from '@nestjs/common';
import type { McpModuleOptions, McpOptionsFactory } from '@mcp-use/nestjs';

@Injectable()
export class SplitTabConfigService implements McpOptionsFactory {
  createMcpOptions(): McpModuleOptions {
    return {
      name: 'splittab-nestjs',
      version: '1.0.0',
      description: 'Enterprise Shared Expense Tracker & Debt Settlement MCP Server',
      basePath: '/mcp',
      inspector: true,
    };
  }
}
