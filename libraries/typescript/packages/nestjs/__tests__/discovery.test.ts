import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Injectable } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { McpContext, McpPrompt, McpResource, McpTool } from '../src/decorators/index.js';
import { McpExplorer } from '../src/discovery/mcp-explorer.service.js';

@Injectable()
class DatabaseService {
  findMovie(id: string) {
    return { id, title: 'Inception', director: 'Christopher Nolan' };
  }
}

@Injectable()
class MovieMcpService {
  constructor(private readonly db: DatabaseService) {}

  @McpTool({
    name: 'get-movie',
    description: 'Find a movie by ID',
  })
  async getMovie({ id }: { id: string }, @McpContext() ctx: any) {
    const movie = this.db.findMovie(id);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ movie, session: ctx?.session }),
        },
      ],
    };
  }

  @McpResource({
    uri: 'movies://catalog',
    name: 'movie-catalog',
  })
  async getCatalog(uri: any) {
    return {
      contents: [{ uri: String(uri), mimeType: 'text/plain', text: 'All movies' }],
    };
  }

  @McpPrompt({
    name: 'recommend-movie',
    description: 'Suggest a movie',
  })
  async recommend() {
    return {
      messages: [{ role: 'user', content: { type: 'text', text: 'Recommend a movie' } }],
    };
  }
}

describe('McpExplorer', () => {
  it('discovers tools, resources, and prompts and preserves dependency injection', async () => {
    const registeredTools: any[] = [];
    const registeredResources: any[] = [];
    const registeredPrompts: any[] = [];

    const mockServer = {
      tool: vi.fn((def, handler) => {
        registeredTools.push({ def, handler });
      }),
      resource: vi.fn((def, handler) => {
        registeredResources.push({ def, handler });
      }),
      prompt: vi.fn((def, handler) => {
        registeredPrompts.push({ def, handler });
      }),
    };

    const dbService = new DatabaseService();
    const movieService = new MovieMcpService(dbService);

    const mockDiscoveryService = {
      getProviders: () => [
        { instance: dbService },
        { instance: movieService },
      ],
      getControllers: () => [],
    } as unknown as DiscoveryService;

    const metadataScanner = new MetadataScanner();
    const reflector = new Reflector();

    const explorer = new McpExplorer(
      mockServer as any,
      mockDiscoveryService,
      metadataScanner,
      reflector
    );

    explorer.explore();

    // Verify tool was registered
    expect(mockServer.tool).toHaveBeenCalled();
    const tool = registeredTools.find((t) => t.def.name === 'get-movie');
    expect(tool).toBeDefined();
    expect(tool.def.description).toBe('Find a movie by ID');

    // Call tool handler and verify it uses this.db correctly (Dependency Injection intact!)
    const result = await tool.handler(
      { id: 'm-42' },
      { session: 'sess-xyz' }
    );
    expect(result).toBeDefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.movie.title).toBe('Inception');
    expect(parsed.movie.director).toBe('Christopher Nolan');
    expect(parsed.session).toBe('sess-xyz');

    // Verify resource was registered
    expect(mockServer.resource).toHaveBeenCalled();
    const resource = registeredResources.find((r) => r.def.name === 'movie-catalog');
    expect(resource).toBeDefined();
    expect(resource.def.uri).toBe('movies://catalog');

    // Verify prompt was registered
    expect(mockServer.prompt).toHaveBeenCalled();
    const prompt = registeredPrompts.find((p) => p.def.name === 'recommend-movie');
    expect(prompt).toBeDefined();
  });
});
