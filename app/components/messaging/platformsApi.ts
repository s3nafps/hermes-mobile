import { untyped } from '@/components/control/client';
import { unwrap, type GatewayHttp } from '@/lib/gateway';

import { firstFlag, firstText, isRecord, nonNull, recordsUnder, textOf, type Raw } from './read';
import type { MessagingPlatform, PlatformGroup, TestResult } from './types';

// GET /api/messaging/platforms returns {} in the generated schema. The reader accepts
// a list or a {platforms: []} wrapper, and a map keyed by platform id.

const LIST_KEYS = ['platforms', 'items', 'messaging_platforms'];
const CONNECTED_STATES = new Set(['connected', 'running', 'online', 'ready']);
const SETUP_STATES = new Set(['needs_setup', 'setup_required', 'not_configured', 'unconfigured', 'missing_config']);

function normalizeState(value: string | null): string {
  return (value ?? '').toLowerCase().replace(/[\s-]+/g, '_');
}

function groupOf(platform: { connected: boolean; needsSetup: boolean }): PlatformGroup {
  if (platform.connected) return 'connected';
  if (platform.needsSetup) return 'setup';
  return 'other';
}

function toPlatform(raw: Raw): MessagingPlatform | null {
  const id = firstText(raw, ['id', 'platform_id', 'platform', 'key', 'slug', 'name']);
  if (!id) return null;
  const state = normalizeState(firstText(raw, ['status', 'state', 'connection']));
  const enabled = firstFlag(raw, ['enabled', 'is_enabled']) ?? false;
  const live = firstFlag(raw, ['connected', 'is_connected', 'running', 'online']);
  const connected = live ?? (CONNECTED_STATES.has(state) || (state === '' && enabled));
  const configured = firstFlag(raw, ['configured', 'is_configured', 'setup_complete', 'ready']);
  const needsSetup =
    firstFlag(raw, ['needs_setup', 'setup_required']) ?? (configured === false || SETUP_STATES.has(state));
  return {
    id,
    name: firstText(raw, ['label', 'display_name', 'name', 'title']) ?? id,
    description: firstText(raw, ['description', 'summary']),
    enabled,
    connected,
    needsSetup,
    group: groupOf({ connected, needsSetup }),
  };
}

const GROUP_ORDER: Record<PlatformGroup, number> = { connected: 0, setup: 1, other: 2 };

function sortPlatforms(platforms: MessagingPlatform[]): MessagingPlatform[] {
  return [...platforms].sort(
    (a, b) => GROUP_ORDER[a.group] - GROUP_ORDER[b.group] || a.name.localeCompare(b.name),
  );
}

// Map form: {telegram: {...}, discord: {...}}. Each entry keeps its key as the id.
function recordsFromMap(raw: unknown): Raw[] {
  if (!isRecord(raw) || LIST_KEYS.some((key) => key in raw)) return [];
  return Object.entries(raw)
    .filter((entry): entry is [string, Raw] => isRecord(entry[1]))
    .map(([key, value]) => ({ id: key, ...value }));
}

export async function loadPlatforms(http: GatewayHttp): Promise<MessagingPlatform[]> {
  const raw = untyped<unknown>(await http.GET('/api/messaging/platforms'));
  const rows = recordsUnder(raw, LIST_KEYS);
  const source = rows.length > 0 ? rows : recordsFromMap(raw);
  return sortPlatforms(source.map(toPlatform).filter(nonNull));
}

export async function setPlatformEnabled(http: GatewayHttp, platformId: string, enabled: boolean): Promise<void> {
  // env and clear_env are required by the request type. Empty values change no keys.
  unwrap(
    await http.PUT('/api/messaging/platforms/{platform_id}', {
      params: { path: { platform_id: platformId } },
      body: { enabled, env: {}, clear_env: [] },
    }),
  );
}

// The test response is untyped. It may carry ok or success, a message, or an error.
function readTestResult(raw: unknown): TestResult {
  if (typeof raw === 'string' && raw.trim()) return { ok: true, text: raw.trim() };
  if (!isRecord(raw)) return { ok: true, text: 'The test finished.' };
  const message = firstText(raw, ['message', 'detail', 'result']);
  const state = normalizeState(firstText(raw, ['status', 'state']));
  const failed =
    firstFlag(raw, ['ok', 'success', 'passed']) === false || raw.error != null || /fail|error/.test(state);
  if (failed) return { ok: false, text: message ?? textOf(raw.error) ?? 'The test failed.' };
  return { ok: true, text: message ?? 'The test passed.' };
}

export async function testPlatform(http: GatewayHttp, platformId: string): Promise<TestResult> {
  const raw = untyped<unknown>(
    await http.POST('/api/messaging/platforms/{platform_id}/test', {
      params: { path: { platform_id: platformId } },
    }),
  );
  return readTestResult(raw);
}

export async function restartGateway(http: GatewayHttp): Promise<void> {
  unwrap(await http.POST('/api/gateway/restart'));
}
