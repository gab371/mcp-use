import { SetMetadata } from '@nestjs/common';
import { MCP_TOOL_METADATA } from '../constants.js';
import type { McpToolOptions } from '../interfaces/decorator-options.js';

/**
 * Decorates a provider method to be exposed as an MCP Tool.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class WeatherService {
 *   @McpTool({
 *     name: 'get-weather',
 *     description: 'Get current weather for a city',
 *     inputSchema: z.object({ city: z.string() }),
 *   })
 *   async getWeather({ city }: { city: string }, @McpContext() ctx: RequestContext) {
 *     return { content: [{ type: 'text', text: `Sunny in ${city}` }] };
 *   }
 * }
 * ```
 */
export function McpTool(options?: McpToolOptions): MethodDecorator {
  return SetMetadata(MCP_TOOL_METADATA, options ?? {});
}
