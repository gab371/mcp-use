import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

declare const process: { env: Record<string, string | undefined> };

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🎬 NestJS MCP Server running on: http://localhost:${port}/mcp`);
  console.log(`🔍 Embedded Inspector available on: http://localhost:${port}/mcp/inspector`);
}

bootstrap();
