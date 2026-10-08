import { untyped } from '@/components/control/client';
import { firstText, flagOf, isRecord, listOf, rawListOf, textOf, type Raw } from '@/components/bots/shared';
import { unwrap, type GatewayHttp } from '@/lib/gateway';

import type { CatalogEntry, McpServer, McpTestResult, Toolset } from './types';

// A list of records, or a map keyed by name (the name comes from the key).
function rowsOf(raw: unknown, keys: string[]): Raw[] {
  if (Array.isArray(raw)) return raw.filter(isRecord);
  if (!isRecord(raw)) return [];
  const listed = listOf(raw, keys);
  if (listed.length > 0) return listed;
  const nested = keys.map((key) => raw[key]).find(isRecord);
  const map = nested ?? raw;
  return Object.entries(map).flatMap(([name, value]) => (isRecord(value) ? [{ name, ...value }] : []));
}

function toServer(raw: Raw): McpServer | null {
  const name = firstText(raw, ['name', 'id']);
  if (!name) return null;
  const url = firstText(raw, ['url']);
  const command = firstText(raw, ['command']);
  return {
    name,
    target: url ?? command,
    transport: url ? 'url' : command ? 'command' : 'unknown',
    enabled: flagOf(raw.enabled) ?? true,
  };
}

function envNames(raw: Raw): string[] {
  const value = raw.required_env ?? raw.env_vars ?? raw.env;
  if (Array.isArray(value)) {
    return value
      .map((item) => (isRecord(item) ? firstText(item, ['name', 'key']) : textOf(item)))
      .filter((name): name is string => !!name);
  }
  return isRecord(value) ? Object.keys(value) : [];
}

function toCatalogEntry(raw: Raw): CatalogEntry | null {
  const name = firstText(raw, ['name', 'id']);
  if (!name) return null;
  return {
    name,
    description: firstText(raw, ['description', 'summary']) ?? '',
    installed: flagOf(raw.installed) === true,
    enabled: flagOf(raw.enabled) === true,
    envVars: envNames(raw),
  };
}

function toToolset(raw: Raw): Toolset | null {
  const name = firstText(raw, ['name', 'id', 'key']);
  if (!name) return null;
  return {
    name,
    label: firstText(raw, ['label', 'title', 'display_name']) ?? name,
    description: firstText(raw, ['description']),
    enabled: flagOf(raw.enabled) === true,
  };
}

// Reads the test reply without assuming its exact shape. It reports the error when one
// is present, otherwise the tool names when the reply lists them.
function testSummary(raw: unknown): McpTestResult {
  const body = isRecord(raw) ? raw : {};
  const error = firstText(body, ['error', 'detail', 'message']);
  if (error && flagOf(body.ok) !== true) return { ok: false, summary: error };
  const names = rawListOf(body, ['tools'])
    .map((tool) => (isRecord(tool) ? firstText(tool, ['name']) : textOf(tool)))
    .filter((name): name is string => !!name);
  if (names.length === 0) return { ok: true, summary: 'Connected.' };
  const shown = names.slice(0, 8).join(', ');
  const more = names.length > 8 ? ` and ${names.length - 8} more` : '';
  return { ok: true, summary: `Connected. ${names.length} tool${names.length === 1 ? '' : 's'}: ${shown}${more}.` };
}

export async function listServers(http: GatewayHttp): Promise<McpServer[]> {
  const raw = untyped<unknown>(await http.GET('/api/mcp/servers'));
  return rowsOf(raw, ['servers', 'items'])
    .map(toServer)
    .filter((server): server is McpServer => server !== null);
}

export type NewServer = {
  name: string;
  url: string | null;
  command: string | null;
  args: string[];
  bearerToken: string | null;
};

export async function addServer(http: GatewayHttp, server: NewServer): Promise<void> {
  unwrap(
    await http.POST('/api/mcp/servers', {
      body: {
        name: server.name,
        url: server.url,
        command: server.command,
        args: server.args,
        env: {},
        bearer_token: server.bearerToken,
      },
    }),
  );
}

export async function setServerEnabled(http: GatewayHttp, name: string, enabled: boolean): Promise<void> {
  unwrap(await http.PUT('/api/mcp/servers/{name}/enabled', { params: { path: { name } }, body: { enabled } }));
}

export async function removeServer(http: GatewayHttp, name: string): Promise<void> {
  unwrap(await http.DELETE('/api/mcp/servers/{name}', { params: { path: { name } } }));
}

export async function testServer(http: GatewayHttp, name: string): Promise<McpTestResult> {
  const raw = untyped<unknown>(await http.POST('/api/mcp/servers/{name}/test', { params: { path: { name } } }));
  return testSummary(raw);
}

export async function listCatalog(http: GatewayHttp): Promise<CatalogEntry[]> {
  const raw = untyped<unknown>(await http.GET('/api/mcp/catalog'));
  return rowsOf(raw, ['entries', 'catalog', 'items'])
    .map(toCatalogEntry)
    .filter((entry): entry is CatalogEntry => entry !== null);
}

export async function installCatalogEntry(
  http: GatewayHttp,
  name: string,
  env: Record<string, string>,
): Promise<void> {
  unwrap(await http.POST('/api/mcp/catalog/install', { body: { name, enable: true, env } }));
}

export async function listToolsets(http: GatewayHttp): Promise<Toolset[]> {
  const raw = untyped<unknown>(await http.GET('/api/tools/toolsets'));
  return rowsOf(raw, ['toolsets', 'items'])
    .map(toToolset)
    .filter((toolset): toolset is Toolset => toolset !== null);
}

export async function setToolsetEnabled(http: GatewayHttp, name: string, enabled: boolean): Promise<void> {
  unwrap(await http.PUT('/api/tools/toolsets/{name}', { params: { path: { name } }, body: { enabled } }));
}
