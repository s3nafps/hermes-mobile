// Readers for responses the generated schema leaves untyped. Each accepts a bare
// value or the usual wrapper, and skips anything it cannot read.

export type Raw = Record<string, unknown>;

export function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function textOf(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
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

// The first boolean among the candidate keys, or null when none is a boolean.
export function firstFlag(raw: Raw, keys: string[]): boolean | null {
  for (const key of keys) {
    const found = flagOf(raw[key]);
    if (found !== null) return found;
  }
  return null;
}

export function numberOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

// The array under the first matching key. A bare array is returned as it is.
export function arrayUnder(raw: unknown, keys: string[]): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!isRecord(raw)) return [];
  for (const key of keys) {
    const value = raw[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

export function recordsUnder(raw: unknown, keys: string[]): Raw[] {
  return arrayUnder(raw, keys).filter(isRecord);
}

// A list of strings from an array, or from a comma or space separated string.
export function stringsOf(value: unknown): string[] {
  if (typeof value === 'string') return value.split(/[\s,]+/).filter(Boolean);
  if (!Array.isArray(value)) return [];
  return value.map(textOf).filter((item): item is string => item !== null);
}

export function nonNull<T>(value: T | null): value is T {
  return value !== null;
}
