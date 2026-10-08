import { firstText, flagOf, isRecord, listOf, textOf, type Raw } from '@/components/bots/shared';

import { formatWhen } from './format';
import type {
  Checkpoint,
  CheckpointList,
  ModelOptions,
  ProviderOption,
  StoredSession,
  TranscriptLine,
} from './types';

// The session, transcript, checkpoint and model replies are untyped in the generated
// schema. Each reader takes a bare value or the usual wrapper and skips what it cannot read.

function numberOf(raw: Raw, keys: string[]): number | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

export function toStoredSession(raw: unknown): StoredSession {
  const row = isRecord(raw) ? raw : {};
  return {
    title: firstText(row, ['title', 'name']) ?? '',
    model: firstText(row, ['model']) ?? '',
    startedAt: numberOf(row, ['started_at', 'created_at']),
    messageCount: numberOf(row, ['message_count']),
  };
}

function speakerOf(role: string): string {
  if (role === 'user') return 'You';
  if (role === 'assistant') return 'Hermes';
  if (role === 'tool') return 'Tool';
  return 'System';
}

export function toTranscript(raw: unknown): TranscriptLine[] {
  const lines: TranscriptLine[] = [];
  for (const item of listOf(raw, ['messages', 'items'])) {
    const text = (firstText(item, ['content', 'text']) ?? '').trim();
    if (!text) continue;
    lines.push({ speaker: speakerOf(firstText(item, ['role']) ?? ''), text });
  }
  return lines;
}

function toCheckpoint(raw: Raw): Checkpoint | null {
  const hash = firstText(raw, ['hash', 'id']);
  if (!hash) return null;
  return {
    hash,
    message: firstText(raw, ['message', 'title']) ?? 'Checkpoint',
    when: formatWhen(raw.timestamp),
  };
}

// rollback.list returns { enabled, checkpoints }. A missing enabled flag is read as on.
export function toCheckpointList(raw: unknown): CheckpointList {
  const row = isRecord(raw) ? raw : {};
  const checkpoints = listOf(row, ['checkpoints'])
    .map(toCheckpoint)
    .filter((item): item is Checkpoint => item !== null);
  return { enabled: flagOf(row.enabled) ?? true, checkpoints };
}

function modelNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const names: string[] = [];
  for (const item of value as unknown[]) {
    const name = isRecord(item) ? firstText(item, ['id', 'model', 'name']) : textOf(item);
    if (name) names.push(name);
  }
  return names;
}

function toProvider(raw: Raw): ProviderOption | null {
  const slug = firstText(raw, ['slug', 'id', 'name']);
  if (!slug) return null;
  return {
    slug,
    name: firstText(raw, ['name', 'label']) ?? slug,
    models: modelNames(raw.models),
    authenticated: flagOf(raw.authenticated) === true,
    isCurrent: flagOf(raw.is_current) === true,
  };
}

export function toModelOptions(raw: unknown): ModelOptions {
  const row = isRecord(raw) ? raw : {};
  return {
    providers: listOf(row, ['providers'])
      .map(toProvider)
      .filter((item): item is ProviderOption => item !== null),
    model: firstText(row, ['model']) ?? '',
    provider: firstText(row, ['provider']) ?? '',
  };
}
