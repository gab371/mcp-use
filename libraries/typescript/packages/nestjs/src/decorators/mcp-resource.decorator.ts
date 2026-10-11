import { SetMetadata } from '@nestjs/common';
import { MCP_RESOURCE_METADATA } from '../constants.js';
import type { McpResourceOptions } from '../interfaces/decorator-options.js';

/**
 * Decorates a provider method to be exposed as an MCP Resource.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class ConfigResourceService {
 *   @McpResource({
 *     uri: 'app://config',
 *     name: 'App Config',
 *     mimeType: 'application/json',
 *   })
 *   async getConfig(uri: URL) {
 *     return {
 *       contents: [
 *         { uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ env: 'prod' }) },
 *       ],
 *     };
 *   }
 * }
 * ```
 */
export function McpResource(options: McpResourceOptions): MethodDecorator {
  return SetMetadata(MCP_RESOURCE_METADATA, options);
}
