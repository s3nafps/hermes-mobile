import { NOT_CONNECTED } from '@/components/control/client';
import type { GatewayHttp } from '@/lib/gateway';

// Helpers shared by the Bots, Memory, Skills and Tools screens. Many of these
// endpoints return {} in the generated schema, so the readers accept a bare value
// or the usual wrapper (for example {profiles: []}) and skip anything they cannot read.

export type Raw = Record<string, unknown>;

export function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function textOf(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

// The first non-empty text among the candidate keys, or null.
export function firstText(raw: Raw, keys: string[]): string | null {
  for (const key of keys) {
    const found = textOf(raw[key]);
    if (found) return found;
  }
  return null;
}

export function flagOf(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

// The first array found under one of the keys, or the value itself when it is a bare array.
export function rawListOf(raw: unknown, keys: string[]): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!isRecord(raw)) return [];
  for (const key of keys) {
    const list = raw[key];
    if (Array.isArray(list)) return list;
  }
  return [];
}

export function listOf(raw: unknown, keys: string[]): Raw[] {
  return rawListOf(raw, keys).filter(isRecord);
}

// Plain text from a bare string, or from the first matching key of an object.
export function contentOf(raw: unknown, keys: string[]): string {
  if (typeof raw === 'string') return raw;
  if (isRecord(raw)) return firstText(raw, keys) ?? '';
  return '';
}

// Primitive fields as label and value rows, for status objects with no fixed shape.
export function primitiveRows(raw: unknown, skip: string[] = []): { label: string; value: string }[] {
  if (!isRecord(raw)) return [];
  return Object.entries(raw)
    .filter(([key, value]) => !skip.includes(key) && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'))
    .map(([key, value]) => ({ label: humanize(key), value: String(value) || '—' }));
}

export function humanize(key: string): string {
  const spaced = key.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function requireHttp(http: GatewayHttp | null): GatewayHttp {
  if (!http) throw new Error(NOT_CONNECTED);
  return http;
}
