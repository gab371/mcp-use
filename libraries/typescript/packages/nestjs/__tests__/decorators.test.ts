import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Reflector } from '@nestjs/core';
import {
  MCP_CONTEXT_PARAM_METADATA,
  MCP_PROMPT_METADATA,
  MCP_RESOURCE_METADATA,
  MCP_TOOL_METADATA,
} from '../src/constants.js';
import {
  McpContext,
  McpPrompt,
  McpResource,
  McpTool,
} from '../src/decorators/index.js';

class SampleService {
  @McpTool({
    name: 'custom-tool',
    description: 'A custom tool description',
    title: 'Custom Tool',
  })
  myTool(args: any, @McpContext() _ctx: any) {
    return { ok: true, args };
  }

  @McpResource({
    uri: 'file:///sample/data.json',
    name: 'sample-data',
    mimeType: 'application/json',
  })
  myResource() {
    return { contents: [] };
  }

  @McpPrompt({
    name: 'sample-prompt',
    description: 'Prompt description',
  })
  myPrompt() {
    return { messages: [] };
  }
}

describe('Mcp Decorators', () => {
  const reflector = new Reflector();
  const instance = new SampleService();

  it('attaches McpTool metadata correctly', () => {
    const meta = reflector.get(MCP_TOOL_METADATA, instance.myTool);
    expect(meta).toBeDefined();
    expect(meta.name).toBe('custom-tool');
    expect(meta.description).toBe('A custom tool description');
    expect(meta.title).toBe('Custom Tool');
  });

  it('attaches McpContext parameter metadata correctly', () => {
    const paramIndex = Reflect.getMetadata(
      MCP_CONTEXT_PARAM_METADATA,
      instance,
      'myTool'
    );
    expect(paramIndex).toBe(1);
  });

  it('attaches McpResource metadata correctly', () => {
    const meta = reflector.get(MCP_RESOURCE_METADATA, instance.myResource);
    expect(meta).toBeDefined();
    expect(meta.name).toBe('sample-data');
    expect(meta.uri).toBe('file:///sample/data.json');
    expect(meta.mimeType).toBe('application/json');
  });

  it('attaches McpPrompt metadata correctly', () => {
    const meta = reflector.get(MCP_PROMPT_METADATA, instance.myPrompt);
    expect(meta).toBeDefined();
    expect(meta.name).toBe('sample-prompt');
    expect(meta.description).toBe('Prompt description');
  });
});
