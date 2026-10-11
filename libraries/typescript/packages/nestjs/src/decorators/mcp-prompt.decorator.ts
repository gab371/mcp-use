import { SetMetadata } from '@nestjs/common';
import { MCP_PROMPT_METADATA } from '../constants.js';
import type { McpPromptOptions } from '../interfaces/decorator-options.js';

/**
 * Decorates a provider method to be exposed as an MCP Prompt.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class PromptService {
 *   @McpPrompt({
 *     name: 'review-code',
 *     description: 'Prompt template to review code snippet',
 *     inputSchema: z.object({ code: z.string() }),
 *   })
 *   async reviewCode({ code }: { code: string }) {
 *     return {
 *       messages: [
 *         { role: 'user', content: { type: 'text', text: `Please review: ${code}` } },
 *       ],
 *     };
 *   }
 * }
 * ```
 */
export function McpPrompt(options?: McpPromptOptions): MethodDecorator {
  return SetMetadata(MCP_PROMPT_METADATA, options ?? {});
}
