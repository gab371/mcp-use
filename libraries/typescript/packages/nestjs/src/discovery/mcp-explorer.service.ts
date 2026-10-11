import {
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
} from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import type { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper.js';
import type { MCPServer } from 'mcp-use';
import {
  MCP_CONTEXT_PARAM_METADATA,
  MCP_PROMPT_METADATA,
  MCP_RESOURCE_METADATA,
  MCP_SERVER_TOKEN,
  MCP_TOOL_METADATA,
} from '../constants.js';
import type {
  McpPromptOptions,
  McpResourceOptions,
  McpToolOptions,
} from '../interfaces/decorator-options.js';

@Injectable()
export class McpExplorer implements OnModuleInit {
  private readonly logger = new Logger('McpExplorer');

  constructor(
    @Inject(MCP_SERVER_TOKEN)
    private readonly server: MCPServer,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector
  ) {}

  onModuleInit(): void {
    this.explore();
  }

  public explore(): void {
    const providers = this.discoveryService.getProviders();
    const controllers = this.discoveryService.getControllers();
    const wrappers: InstanceWrapper[] = [...providers, ...controllers];

    for (const wrapper of wrappers) {
      const { instance } = wrapper;
      if (!instance || typeof instance !== 'object') {
        continue;
      }

      const prototype = Object.getPrototypeOf(instance);
      if (!prototype || prototype === Object.prototype) {
        continue;
      }

      const methodNames: string[] =
        typeof this.metadataScanner.getAllMethodNames === 'function'
          ? Array.from(this.metadataScanner.getAllMethodNames(prototype))
          : Object.getOwnPropertyNames(prototype).filter(
              (prop) =>
                prop !== 'constructor' &&
                typeof (instance as Record<string, any>)[prop] === 'function'
            );

      for (const methodName of methodNames) {
        const methodRef = (instance as Record<string, any>)[methodName];
        if (typeof methodRef !== 'function') {
          continue;
        }

        this.bindTool(instance, methodName, methodRef);
        this.bindResource(instance, methodName, methodRef);
        this.bindPrompt(instance, methodName, methodRef);
      }
    }
  }

  private bindTool(
    instance: any,
    methodName: string,
    methodRef: (...args: any[]) => any
  ): void {
    const toolMeta = this.reflector.get<McpToolOptions>(
      MCP_TOOL_METADATA,
      methodRef
    );
    if (!toolMeta) {
      return;
    }

    const toolName = toolMeta.name || methodName;
    const ctxParamIndex = Reflect.getMetadata(
      MCP_CONTEXT_PARAM_METADATA,
      instance,
      methodName
    );

    const schema = toolMeta.inputSchema ?? toolMeta.schema;
    const toolDef: Record<string, any> = {
      name: toolName,
    };
    if (toolMeta.description) toolDef.description = toolMeta.description;
    if (toolMeta.title) toolDef.title = toolMeta.title;
    if (schema) toolDef.inputSchema = schema;
    if (toolMeta.outputSchema) toolDef.outputSchema = toolMeta.outputSchema;
    if (toolMeta.view) toolDef.view = toolMeta.view;
    if (toolMeta.annotations) toolDef.annotations = toolMeta.annotations;

    const boundHandler = async (args: any, context?: any) => {
      if (typeof ctxParamIndex === 'number') {
        const callArgs: any[] = [];
        callArgs[0] = args;
        callArgs[ctxParamIndex] = context;
        return methodRef.apply(instance, callArgs);
      }
      return methodRef.call(instance, args, context);
    };

    this.server.tool(toolDef as any, boundHandler as any);
    this.logger.log(`Registered MCP Tool: "${toolName}" from ${instance.constructor.name}.${methodName}`);
  }

  private bindResource(
    instance: any,
    methodName: string,
    methodRef: (...args: any[]) => any
  ): void {
    const resourceMeta = this.reflector.get<McpResourceOptions>(
      MCP_RESOURCE_METADATA,
      methodRef
    );
    if (!resourceMeta) {
      return;
    }

    const resourceName = resourceMeta.name || methodName;
    const resDef: Record<string, any> = {
      name: resourceName,
      uri: resourceMeta.uri,
    };
    if (resourceMeta.title) resDef.title = resourceMeta.title;
    if (resourceMeta.description) resDef.description = resourceMeta.description;
    if (resourceMeta.mimeType) resDef.mimeType = resourceMeta.mimeType;

    const boundHandler = async (uri: any, context?: any) => {
      return methodRef.call(instance, uri, context);
    };

    this.server.resource(resDef as any, boundHandler as any);
    this.logger.log(`Registered MCP Resource: "${resourceName}" (${resourceMeta.uri}) from ${instance.constructor.name}.${methodName}`);
  }

  private bindPrompt(
    instance: any,
    methodName: string,
    methodRef: (...args: any[]) => any
  ): void {
    const promptMeta = this.reflector.get<McpPromptOptions>(
      MCP_PROMPT_METADATA,
      methodRef
    );
    if (!promptMeta) {
      return;
    }

    const promptName = promptMeta.name || methodName;
    const schema = promptMeta.inputSchema ?? promptMeta.schema;
    const promptDef: Record<string, any> = {
      name: promptName,
    };
    if (promptMeta.title) promptDef.title = promptMeta.title;
    if (promptMeta.description) promptDef.description = promptMeta.description;
    if (schema) promptDef.schema = schema;

    const boundHandler = async (args: any, context?: any) => {
      return methodRef.call(instance, args, context);
    };

    this.server.prompt(promptDef as any, boundHandler as any);
    this.logger.log(`Registered MCP Prompt: "${promptName}" from ${instance.constructor.name}.${methodName}`);
  }
}
