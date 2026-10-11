import type { ModuleMetadata, Type } from '@nestjs/common';

export interface McpInspectorOptions {
  basePath?: string;
  autoConnectUrl?: string;
  oauthProxyAllowLoopback?: boolean;
  oauthProxyAllowedOrigins?: string[];
  [key: string]: any;
}

export interface McpModuleOptions {
  /**
   * MCP server name. Defaults to "nestjs-mcp".
   */
  name?: string;

  /**
   * MCP server semantic version. Defaults to "1.0.0".
   */
  version?: string;

  /**
   * MCP server description.
   */
  description?: string;

  /**
   * HTTP base path for the MCP server. Defaults to "/mcp".
   */
  basePath?: string;

  /**
   * Enable or configure the embedded Inspector.
   * If true, mounts inspector at `${basePath}/inspector`.
   */
  inspector?: boolean | McpInspectorOptions;

  /**
   * Extra constructor options passed to MCPServer.
   */
  serverOptions?: Record<string, any>;
}

export interface McpOptionsFactory {
  createMcpOptions(): Promise<McpModuleOptions> | McpModuleOptions;
}

export interface McpModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<McpOptionsFactory>;
  useClass?: Type<McpOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<McpModuleOptions> | McpModuleOptions;
  inject?: any[];
}
