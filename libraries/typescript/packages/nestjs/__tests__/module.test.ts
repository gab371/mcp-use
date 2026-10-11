import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Injectable, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MCPServer } from 'mcp-use';
import { MCP_MODULE_OPTIONS, MCP_SERVER_TOKEN } from '../src/constants.js';
import { McpTool } from '../src/decorators/index.js';
import { McpModule } from '../src/mcp.module.js';

@Injectable()
class ConfigService {
  getServerName() {
    return 'async-configured-mcp';
  }
}

@Injectable()
class EchoService {
  @McpTool({ name: 'echo', description: 'Echo back text' })
  echo({ text }: { text: string }) {
    return { content: [{ type: 'text', text }] };
  }
}

describe('McpModule', () => {
  it('initializes synchronously with McpModule.forRoot()', async () => {
    @Module({
      imports: [
        McpModule.forRoot({
          name: 'test-mcp-server',
          version: '2.0.0',
          basePath: '/custom-mcp',
        }),
      ],
      providers: [EchoService],
    })
    class AppModule {}

    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

    const server = app.get(MCP_SERVER_TOKEN);
    const options = app.get(MCP_MODULE_OPTIONS);

    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(MCPServer);
    expect(options.name).toBe('test-mcp-server');
    expect(options.basePath).toBe('/custom-mcp');

    await app.close();
  });

  it('initializes asynchronously with McpModule.forRootAsync() using useFactory and inject', async () => {
    @Module({
      providers: [ConfigService],
      exports: [ConfigService],
    })
    class ConfigModule {}

    @Module({
      imports: [
        ConfigModule,
        McpModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (config: ConfigService) => ({
            name: config.getServerName(),
            version: '3.1.0',
          }),
          inject: [ConfigService],
        }),
      ],
      providers: [EchoService],
    })
    class AsyncAppModule {}

    const app = await NestFactory.createApplicationContext(AsyncAppModule, { logger: false });

    const server = app.get(MCP_SERVER_TOKEN);
    const options = app.get(MCP_MODULE_OPTIONS);

    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(MCPServer);
    expect(options.name).toBe('async-configured-mcp');
    expect(options.version).toBe('3.1.0');

    await app.close();
  });
});
