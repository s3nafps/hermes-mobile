import { Alert } from 'react-native';

export type Tone = 'neutral' | 'accent' | 'running' | 'done' | 'danger' | 'info';

export function formatWhen(value: string | null, fallback = 'Not yet'): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// "in_progress" becomes "In progress".
export function labelFor(value: string | null | undefined, fallback = 'Unknown'): string {
  if (!value) return fallback;
  const spaced = value.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function toneFor(status: string | null | undefined): Tone {
  const value = (status ?? '').toLowerCase();
  if (['ok', 'success', 'succeeded', 'done', 'completed', 'complete'].includes(value)) return 'done';
  if (['error', 'failed', 'failure', 'blocked'].includes(value)) return 'danger';
  if (['running', 'in_progress', 'started', 'active'].includes(value)) return 'running';
  if (['ready', 'todo', 'triage'].includes(value)) return 'info';
  return 'neutral';
}

export function formatSize(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Asks before an action that stops work, removes something, or changes status for others.
export function confirmFirst(
  title: string,
  message: string,
  actionLabel: string,
  onConfirm: () => void,
  destructive = false,
): void {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: actionLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
