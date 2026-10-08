// MCP servers, the MCP catalog and toolsets. These endpoints are untyped in the
// generated schema, so api.ts reads them defensively.

export type McpServer = {
  name: string;
  target: string | null;
  transport: 'url' | 'command' | 'unknown';
  enabled: boolean;
};

export type CatalogEntry = {
  name: string;
  description: string;
  installed: boolean;
  enabled: boolean;
  envVars: string[];
};

export type Toolset = {
  name: string;
  label: string;
  description: string | null;
  enabled: boolean;
};

export type McpTestResult = {
  ok: boolean;
  summary: string;
};
