// Memory status from GET /api/memory, the provider list, and per-provider settings.
// The endpoints are untyped in the generated schema, so api.ts reads them defensively.

export type MemoryEntry = {
  id: string;
  text: string;
  detail: string | null;
};

export type MemoryProvider = {
  name: string;
  label: string;
  description: string | null;
};

export type MemoryStatus = {
  provider: string | null;
  providers: MemoryProvider[];
  entries: MemoryEntry[];
  stats: { label: string; value: string }[];
};

// One setting from GET /api/memory/providers/{name}/config. Secrets are never prefilled.
export type ProviderSetting = {
  key: string;
  value: string;
  kind: 'string' | 'number' | 'boolean';
  secret: boolean;
};
