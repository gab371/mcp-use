import {
  type DynamicModule,
  Global,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  type Provider,
} from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { MCP_MODULE_OPTIONS, MCP_SERVER_TOKEN } from './constants.js';
import { McpMiddleware } from './core/mcp-middleware.js';
import { McpServerProvider } from './core/mcp-server.provider.js';
import { McpExplorer } from './discovery/mcp-explorer.service.js';
import type {
  McpModuleAsyncOptions,
  McpModuleOptions,
  McpOptionsFactory,
} from './interfaces/mcp-module-options.js';

@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [McpServerProvider, McpExplorer, McpMiddleware],
  exports: [MCP_SERVER_TOKEN, MCP_MODULE_OPTIONS],
})
export class McpModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(McpMiddleware).forRoutes('*');
  }

  static forRoot(options: McpModuleOptions = {}): DynamicModule {
    const optionsProvider: Provider = {
      provide: MCP_MODULE_OPTIONS,
      useValue: options,
    };

    return {
      module: McpModule,
      imports: [DiscoveryModule],
      providers: [optionsProvider, McpServerProvider, McpExplorer, McpMiddleware],
      exports: [MCP_SERVER_TOKEN, MCP_MODULE_OPTIONS],
    };
  }

  static forRootAsync(options: McpModuleAsyncOptions): DynamicModule {
    const asyncProviders = this.createAsyncProviders(options);

    return {
      module: McpModule,
      imports: [...(options.imports ?? []), DiscoveryModule],
      providers: [
        ...asyncProviders,
        McpServerProvider,
        McpExplorer,
        McpMiddleware,
      ],
      exports: [MCP_SERVER_TOKEN, MCP_MODULE_OPTIONS],
    };
  }

  private static createAsyncProviders(
    options: McpModuleAsyncOptions
  ): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider(options)];
    }

    if (options.useClass) {
      return [
        this.createAsyncOptionsProvider(options),
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
      ];
    }

    return [];
  }

  private static createAsyncOptionsProvider(
    options: McpModuleAsyncOptions
  ): Provider {
    if (options.useFactory) {
      return {
        provide: MCP_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject ?? [],
      };
    }

    const inject = options.useExisting || options.useClass;
    return {
      provide: MCP_MODULE_OPTIONS,
      useFactory: async (optionsFactory: McpOptionsFactory) =>
        optionsFactory.createMcpOptions(),
      inject: inject ? [inject] : [],
    };
  }
}
