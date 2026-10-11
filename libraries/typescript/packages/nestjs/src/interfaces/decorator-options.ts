export interface McpToolViewOptions {
  name: string;
  description?: string;
  prefersBorder?: boolean;
  csp?: Record<string, any>;
  [key: string]: any;
}

export interface McpToolOptions {
  name?: string;
  title?: string;
  description?: string;
  /**
   * Zod or JSON-Schema input validation schema.
   * Can be passed as `inputSchema` or `schema`.
   */
  inputSchema?: any;
  schema?: any;
  outputSchema?: any;
  /**
   * Optional associated view name or view options.
   */
  view?: string | McpToolViewOptions;
  annotations?: any;
}

export interface McpResourceOptions {
  uri: string;
  name?: string;
  title?: string;
  description?: string;
  mimeType?: string;
}

export interface McpPromptOptions {
  name?: string;
  title?: string;
  description?: string;
  inputSchema?: any;
  schema?: any;
}
