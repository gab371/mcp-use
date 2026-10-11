import { MCP_CONTEXT_PARAM_METADATA } from '../constants.js';

/**
 * Parameter decorator that marks a method parameter to receive the MCP RequestContext.
 *
 * @example
 * ```typescript
 * @McpTool({ name: 'whoami' })
 * async whoami(_args: unknown, @McpContext() ctx: RequestContext) {
 *   return {
 *     content: [{ type: 'text', text: `Session: ${ctx.params?._meta?.['openai/session']}` }],
 *   };
 * }
 * ```
 */
export function McpContext(): ParameterDecorator {
  return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (!propertyKey) {
      return;
    }
    Reflect.defineMetadata(MCP_CONTEXT_PARAM_METADATA, parameterIndex, target, propertyKey);
  };
}
