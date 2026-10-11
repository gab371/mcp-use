import 'reflect-metadata';
import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import { Injectable, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { z } from 'zod';
import { McpMiddleware } from '../src/core/mcp-middleware.js';
import { McpTool } from '../src/decorators/index.js';
import { McpModule } from '../src/mcp.module.js';

function parseMcpResponse(rawText: string) {
  const dataLine = rawText
    .split('\n')
    .find((line) => line.startsWith('data: '));
  if (dataLine) {
    return JSON.parse(dataLine.slice(6));
  }
  return JSON.parse(rawText);
}

@Injectable()
class CalculatorService {
  @McpTool({
    name: 'add',
    description: 'Add two numbers together',
    inputSchema: z.object({
      a: z.number(),
      b: z.number(),
    }),
  })
  add({ a, b }: { a: number; b: number }) {
    return {
      content: [{ type: 'text', text: `Result: ${a + b}` }],
    };
  }
}

@Module({
  imports: [
    McpModule.forRoot({
      name: 'calc-mcp',
      version: '1.0.0',
      basePath: '/mcp',
    }),
  ],
  providers: [CalculatorService],
})
class AppModule {}

describe('McpModule HTTP End-to-End', () => {
  it('serves both MCP endpoints and application fallback routes', async () => {
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });
    const middleware = app.get(McpMiddleware);

    // Create an HTTP server wired to McpMiddleware + fallback routes
    const server = createServer(async (req, res) => {
      await middleware.use(req, res, () => {
        // Fallback for non-MCP application routes
        if (req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'healthy' }));
          return;
        }
        res.writeHead(404);
        res.end('Not Found');
      });
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      // 1. Verify standard non-MCP route falls through and works normally
      const healthRes = await fetch(`${baseUrl}/health`);
      expect(healthRes.status).toBe(200);
      const healthData = await healthRes.json();
      expect(healthData).toEqual({ status: 'healthy' });

      // 2. Verify MCP endpoint responds to initialize JSON-RPC request
      const initRes = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            clientInfo: { name: 'test-client', version: '1.0.0' },
            capabilities: {},
          },
        }),
      });

      expect(initRes.status).toBe(200);
      const initData = parseMcpResponse(await initRes.text());
      expect(initData.result).toBeDefined();
      expect(initData.result.serverInfo.name).toBe('calc-mcp');

      // 3. Verify tools/list returns the registered tool
      const toolsRes = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {},
        }),
      });

      expect(toolsRes.status).toBe(200);
      const toolsData = parseMcpResponse(await toolsRes.text());
      expect(toolsData.result.tools).toBeDefined();
      const addTool = toolsData.result.tools.find((t: any) => t.name === 'add');
      expect(addTool).toBeDefined();
      expect(addTool.description).toBe('Add two numbers together');

      // 4. Verify tools/call executes the method and returns the calculated sum
      const callRes = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'add',
            arguments: { a: 15, b: 27 },
          },
        }),
      });

      expect(callRes.status).toBe(200);
      const callData = parseMcpResponse(await callRes.text());
      expect(callData.result.content[0].text).toBe('Result: 42');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await app.close();
    }
  });
});
