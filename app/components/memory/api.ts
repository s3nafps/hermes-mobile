import { untyped } from '@/components/control/client';
import { firstText, isRecord, primitiveRows, rawListOf, textOf, type Raw } from '@/components/bots/shared';
import { unwrap, type GatewayHttp } from '@/lib/gateway';

import type { MemoryEntry, MemoryProvider, MemoryStatus, ProviderSetting } from './types';

// Keys that name the active provider in the status response.
const PROVIDER_KEYS = ['provider', 'active_provider', 'memory_provider', 'active'];

function providerName(value: unknown): string | null {
  if (isRecord(value)) return firstText(value, ['name', 'id', 'slug']);
  return textOf(value);
}

function toProvider(item: unknown): MemoryProvider | null {
  const name = providerName(item);
  if (!name) return null;
  if (!isRecord(item)) return { name, label: name, description: null };
  return {
    name,
    label: firstText(item, ['label', 'display_name', 'title']) ?? name,
    description: firstText(item, ['description']),
  };
}

function toEntry(item: unknown, index: number): MemoryEntry | null {
  if (typeof item === 'string') return { id: String(index), text: item, detail: null };
  if (!isRecord(item)) return null;
  return {
    id: firstText(item, ['id', 'key']) ?? String(index),
    text: firstText(item, ['content', 'text', 'value', 'summary', 'title', 'name']) ?? 'Empty entry',
    detail: firstText(item, ['target', 'kind', 'category', 'source', 'updated_at', 'created_at']),
  };
}

function toStatus(raw: unknown): MemoryStatus {
  const root: Raw = isRecord(raw) ? raw : {};
  const statsSource = isRecord(root.stats) ? root.stats : root;
  const provider = PROVIDER_KEYS.map((key) => providerName(root[key])).find((name) => name) ?? null;
  return {
    provider,
    providers: rawListOf(root, ['providers', 'available'])
      .map(toProvider)
      .filter((item): item is MemoryProvider => item !== null),
    entries: rawListOf(root, ['entries', 'memories', 'items'])
      .map(toEntry)
      .filter((item): item is MemoryEntry => item !== null),
    stats: primitiveRows(statsSource, PROVIDER_KEYS),
  };
}

export async function loadMemory(http: GatewayHttp): Promise<MemoryStatus> {
  return toStatus(untyped<unknown>(await http.GET('/api/memory')));
}

export async function setMemoryProvider(http: GatewayHttp, provider: string): Promise<void> {
  unwrap(await http.PUT('/api/memory/provider', { body: { provider } }));
}

// Erases everything the agent remembers. The screen asks for confirmation first.
export async function resetMemory(http: GatewayHttp): Promise<void> {
  unwrap(await http.POST('/api/memory/reset', { body: { target: 'all' } }));
}

export function isSecretKey(key: string): boolean {
  return /key|token|secret|password/i.test(key);
}

const META_KEYS = ['name', 'provider', 'ok', 'error', 'label', 'description'];

export async function loadProviderSettings(http: GatewayHttp, provider: string): Promise<ProviderSetting[]> {
  const raw = untyped<unknown>(
    await http.GET('/api/memory/providers/{name}/config', { params: { path: { name: provider } } }),
  );
  const source = isRecord(raw) && isRecord(raw.values) ? raw.values : isRecord(raw) && isRecord(raw.config) ? raw.config : raw;
  if (!isRecord(source)) return [];
  return Object.entries(source).flatMap(([key, value]): ProviderSetting[] => {
    if (META_KEYS.includes(key)) return [];
    const secret = isSecretKey(key);
    if (typeof value === 'string') {
      return [{ key, value: secret ? '' : value, kind: 'string', secret }];
    }
    if (typeof value === 'number') return [{ key, value: String(value), kind: 'number', secret: false }];
    if (typeof value === 'boolean') return [{ key, value: String(value), kind: 'boolean', secret: false }];
    return [];
  });
}

export async function saveProviderSettings(
  http: GatewayHttp,
  provider: string,
  values: Record<string, string | number | boolean>,
): Promise<void> {
  unwrap(
    await http.PUT('/api/memory/providers/{name}/config', {
      params: { path: { name: provider } },
      body: { values },
    }),
  );
}
