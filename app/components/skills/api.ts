import { untyped } from '@/components/control/client';
import { contentOf, firstText, flagOf, isRecord, listOf, primitiveRows, type Raw } from '@/components/bots/shared';
import { unwrap, type GatewayHttp } from '@/lib/gateway';

import type { CuratorStatus, HubSkill, InstalledSkill } from './types';

function toInstalled(raw: Raw): InstalledSkill | null {
  const name = firstText(raw, ['name', 'id']);
  if (!name) return null;
  return {
    name,
    description: firstText(raw, ['description']) ?? '',
    category: firstText(raw, ['category']),
    enabled: flagOf(raw.enabled) ?? true,
  };
}

function toHub(raw: Raw): HubSkill | null {
  const identifier = firstText(raw, ['identifier', 'id', 'name']);
  if (!identifier) return null;
  return {
    identifier,
    name: firstText(raw, ['name']) ?? identifier,
    description: firstText(raw, ['description']) ?? '',
    source: firstText(raw, ['source', 'registry']),
    trust: firstText(raw, ['trust', 'trust_level', 'tier']),
    installed: flagOf(raw.installed) === true,
  };
}

export async function listInstalled(http: GatewayHttp): Promise<InstalledSkill[]> {
  const raw = untyped<unknown>(await http.GET('/api/skills'));
  return listOf(raw, ['skills', 'items'])
    .map(toInstalled)
    .filter((skill): skill is InstalledSkill => skill !== null);
}

export async function toggleSkill(http: GatewayHttp, name: string, enabled: boolean): Promise<void> {
  unwrap(await http.PUT('/api/skills/toggle', { body: { name, enabled } }));
}

export async function getSkillContent(http: GatewayHttp, name: string): Promise<string> {
  const raw = untyped<unknown>(await http.GET('/api/skills/content', { params: { query: { name } } }));
  return contentOf(raw, ['content', 'text', 'skill']);
}

export async function saveSkillContent(http: GatewayHttp, name: string, content: string): Promise<void> {
  unwrap(await http.PUT('/api/skills/content', { body: { name, content } }));
}

export async function searchHub(http: GatewayHttp, query: string): Promise<HubSkill[]> {
  const raw = untyped<unknown>(await http.GET('/api/skills/hub/search', { params: { query: { q: query, limit: 20 } } }));
  return listOf(raw, ['results', 'skills', 'items'])
    .map(toHub)
    .filter((skill): skill is HubSkill => skill !== null);
}

export async function installHubSkill(http: GatewayHttp, identifier: string): Promise<void> {
  unwrap(await http.POST('/api/skills/hub/install', { body: { identifier } }));
}

export async function updateHubSkills(http: GatewayHttp): Promise<void> {
  unwrap(await http.POST('/api/skills/hub/update'));
}

export async function loadCurator(http: GatewayHttp): Promise<CuratorStatus> {
  const raw = untyped<unknown>(await http.GET('/api/curator'));
  return {
    paused: isRecord(raw) ? flagOf(raw.paused) : null,
    rows: primitiveRows(raw, ['paused']),
  };
}

export async function runCurator(http: GatewayHttp): Promise<void> {
  unwrap(await http.POST('/api/curator/run'));
}

export async function setCuratorPaused(http: GatewayHttp, paused: boolean): Promise<void> {
  unwrap(await http.PUT('/api/curator/paused', { body: { paused } }));
}
