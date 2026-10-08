// Shape of GET /api/status. The server does not publish a schema for this
// endpoint, so the type is written from the live response (Hermes 0.19.0).
// Full provider details come from GET /api/auth/providers. /api/status lists names only.
export type AuthProvider = {
  name: string;
  display_name?: string;
  supports_password?: boolean;
  [key: string]: unknown;
};

export type GatewayStatus = {
  version: string;
  release_date: string;
  config_version: number;
  latest_config_version: number;
  can_update_hermes: boolean;
  gateway_running: boolean;
  gateway_state: string | null;
  gateway_platforms: Record<string, unknown>;
  gateway_exit_reason: string | null;
  gateway_updated_at: string | number | null;
  active_agents: number;
  gateway_busy: boolean;
  gateway_drainable: boolean;
  restart_drain_timeout: number;
  active_sessions: number;
  auth_required: boolean;
  auth_providers: string[];
  nous_session_valid: string;
  profiles: string[];
  gateway_mode: string;
  hermes_home: string;
  config_path: string;
  env_path: string;
  gateway_pid: number | null;
  gateway_health_url: string | null;
  gateways: unknown[];
};
