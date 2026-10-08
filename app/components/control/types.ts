// Hand-written shapes for gateway endpoints that the OpenAPI schema leaves untyped.
// Each type says whether it was checked against a live response. Fields marked
// "unverified" come from the endpoint's documented return value and must be
// confirmed against a logged-in gateway before the screens are trusted.

// GET /api/config/schema. Verified against the live gateway.
export type ConfigFieldType = 'string' | 'number' | 'boolean' | 'bool' | 'list' | 'select';

export type ConfigSchemaField = {
  type: ConfigFieldType;
  description: string;
  category: string;
  options?: string[];
};

export type ConfigSchema = {
  fields: Record<string, ConfigSchemaField>;
  category_order: string[];
};

// GET /api/config and GET /api/config/defaults. The defaults response is verified and
// has the same nested shape as the config file. The /api/config response is unverified.
export type ConfigObject = Record<string, unknown>;

// GET /api/config/raw. Unverified. The endpoint returns the config.yaml text and its path.
export type RawConfig = {
  yaml_text?: string;
  yaml?: string;
  path?: string;
};

// GET /api/dashboard/themes. Verified against the live gateway.
export type ThemeInfo = {
  name: string;
  label: string;
  description: string;
};

export type ThemesResponse = {
  themes: ThemeInfo[];
  active: string;
};

// GET /api/system/stats. Unverified. Field names follow the endpoint description
// (memory and disk usage, reported as percentages).
export type SystemStats = {
  memory?: { percent?: number | null } | null;
  disk?: { percent?: number | null } | null;
};

// GET /api/analytics/usage. Unverified.
export type UsageTotals = {
  total_input: number;
  total_output: number;
  total_cache_read: number;
  total_estimated_cost: number;
  total_sessions: number;
};

export type UsageAnalytics = {
  period_days: number;
  totals: UsageTotals;
};

// GET /api/analytics/models. Unverified.
export type ModelUsage = {
  model: string;
  sessions: number;
  total_input: number;
  total_output: number;
  total_cache_read: number;
  total_estimated_cost: number;
};

export type ModelAnalytics = {
  models: ModelUsage[];
};

// GET /api/logs. Unverified.
export type LogsResponse = {
  file?: string;
  lines: string[];
};

// GET /api/env. Unverified. Keyed by variable name. Values are redacted by the server.
export type EnvVarInfo = {
  is_set: boolean;
  redacted_value?: string | null;
  description?: string;
  category?: string;
};

export type EnvVars = Record<string, EnvVarInfo>;

// GET /api/hermes/update/check. Unverified. Fields come from the endpoint's documented return value.
export type UpdateCheck = {
  install_method?: string;
  current_version?: string;
  behind?: number | null;
  update_available?: boolean;
  can_apply?: boolean;
  update_command?: string | null;
  message?: string | null;
  commits?: { sha: string; summary: string; author?: string; at?: string }[];
};
