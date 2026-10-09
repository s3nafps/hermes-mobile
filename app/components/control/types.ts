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

// GET /api/system/stats, as sent by the Hermes server (hermes_cli/web_server.py).
// CPU, memory, disk, load and uptime come from psutil on the host, so any of them can be missing.
export type SystemStats = {
  hostname?: string;
  platform?: string;
  cpu_count?: number | null;
  cpu_percent?: number | null;
  load_avg?: number[];
  uptime_seconds?: number;
  memory?: { total?: number; used?: number; percent?: number | null } | null;
  disk?: { total?: number; used?: number; percent?: number | null } | null;
};

// POST /api/ops/security-audit starts `hermes security audit` on the host. Its output is
// read back from GET /api/actions/security-audit/status, which tails the audit log.
export type AuditStatus = {
  name: string;
  running: boolean;
  exit_code: number | null;
  pid: number | null;
  lines: string[];
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
