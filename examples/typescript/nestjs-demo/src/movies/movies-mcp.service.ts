import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  McpContext,
  McpPrompt,
  McpResource,
  McpTool,
} from '@mcp-use/nestjs';
import { MoviesService } from './movies.service.js';

@Injectable()
export class MoviesMcpService {
  constructor(private readonly moviesService: MoviesService) {}

  @McpTool({
    name: 'search_movies',
    description: 'Search movies in catalog by keyword or genre',
    inputSchema: z.object({
      query: z.string().describe('Search keyword or genre'),
    }),
  })
  async searchMovies({ query }: { query: string }, @McpContext() ctx?: any) {
    const results = this.moviesService.search(query);
    const session = ctx?.params?._meta?.['openai/session'] ?? 'local';

    return {
      content: [
        {
          type: 'text',
          text: `Found ${results.length} movie(s) for query "${query}" (session: ${session}):\n${JSON.stringify(
            results,
            null,
            2
          )}`,
        },
      ],
    };
  }

  @McpTool({
    name: 'get_movie_details',
    description: 'Retrieve detailed information for a specific movie by ID',
    inputSchema: z.object({
      id: z.string().describe('Movie ID, e.g. "m-1"'),
    }),
  })
  async getMovieDetails({ id }: { id: string }) {
    const movie = this.moviesService.getById(id);
    if (!movie) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Movie with ID "${id}" not found.` }],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(movie, null, 2),
        },
      ],
    };
  }

  @McpResource({
    uri: 'movies://catalog/all',
    name: 'all-movies-catalog',
    title: 'Complete Movie Catalog',
    description: 'Returns all available movies in the catalog as JSON',
    mimeType: 'application/json',
  })
  async getCatalogResource(uri: any) {
    const all = this.moviesService.getAll();
    return {
      contents: [
        {
          uri: String(uri),
          mimeType: 'application/json',
          text: JSON.stringify(all, null, 2),
        },
      ],
    };
  }

  @McpPrompt({
    name: 'movie_critic_recommendation',
    title: 'Movie Critic Recommendation',
    description: 'Prompt template to recommend a movie with film critic styling',
    inputSchema: z.object({
      favoriteGenre: z.string().describe('User favorite genre'),
    }),
  })
  async criticPrompt({ favoriteGenre }: { favoriteGenre: string }) {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `You are an expert film critic. Based on the catalog, recommend the best ${favoriteGenre} film and provide insightful critique.`,
          },
        },
      ],
    };
  }
}
