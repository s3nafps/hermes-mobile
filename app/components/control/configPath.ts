import type { ConfigObject, ConfigSchemaField } from './types';

// Helpers for the config object, which is nested and addressed by dotted keys
// such as "agent.max_turns" (the same keys the config schema uses).

export function getPath(source: ConfigObject | undefined, dotted: string): unknown {
  let current: unknown = source;
  for (const part of dotted.split('.')) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// Returns a copy of the config with one value changed. The input is not mutated.
export function setPath(source: ConfigObject, dotted: string, value: unknown): ConfigObject {
  const root: ConfigObject = cloneConfig(source);
  const parts = dotted.split('.');
  let node: Record<string, unknown> = root;
  parts.slice(0, -1).forEach((part) => {
    const next = node[part];
    if (!next || typeof next !== 'object' || Array.isArray(next)) node[part] = {};
    node = node[part] as Record<string, unknown>;
  });
  node[parts[parts.length - 1]] = value;
  return root;
}

export function cloneConfig(source: ConfigObject | undefined): ConfigObject {
  return source ? (JSON.parse(JSON.stringify(source)) as ConfigObject) : {};
}

// Which keys hold secrets is decided in one place, so every screen hides the same values.
export { isSecretKey } from '@/lib/secrets';

// Schema descriptions look like "Agent → Max Turns". The screen only needs the last part.
export function fieldLabel(description: string): string {
  const parts = description.split('→');
  return (parts[parts.length - 1] ?? description).trim();
}

export function titleCase(text: string): string {
  return text
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Turns what the form holds back into the value the config file expects.
// Throws a readable error for a number field that does not hold a number.
export function coerceFieldValue(field: ConfigSchemaField, raw: unknown, label: string): unknown {
  if (field.type === 'boolean' || field.type === 'bool') return raw === true;
  if (field.type === 'number') {
    if (typeof raw === 'number') return raw;
    const text = String(raw ?? '').trim();
    if (text === '') return null;
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) throw new Error(`${label} must be a number.`);
    return parsed;
  }
  if (field.type === 'list') {
    if (Array.isArray(raw)) return raw;
    return String(raw ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return typeof raw === 'string' ? raw : String(raw ?? '');
}
