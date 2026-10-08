// Display helpers for numbers, money and rates on the Control screens.

export function compactNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(Math.round(value));
}

export function money(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value > 0 && value < 0.01) return '<$0.01';
  return `$${value.toFixed(2)}`;
}

export function percent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${Math.round(value)}%`;
}

// Share of input tokens that were served from the prompt cache. Returns null when
// there is no input to measure, so the screen can show a dash instead of 0%.
export function cacheHitRate(input: number, cacheRead: number): number | null {
  const total = input + cacheRead;
  if (total <= 0) return null;
  return (cacheRead / total) * 100;
}
