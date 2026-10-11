import { Module } from '@nestjs/common';
import { McpModule } from '@mcp-use/nestjs';
import { MoviesService } from './movies/movies.service.js';
import { MoviesMcpService } from './movies/movies-mcp.service.js';

@Module({
  imports: [
    McpModule.forRoot({
      name: 'nestjs-cinematch',
      version: '1.0.0',
      description: 'Enterprise Movie Recommendation MCP Server with NestJS',
      basePath: '/mcp',
      inspector: true,
    }),
  ],
  providers: [MoviesService, MoviesMcpService],
})
export class AppModule {}
