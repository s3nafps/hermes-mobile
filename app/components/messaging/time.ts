import { useEffect, useState } from 'react';

import { numberOf, textOf, type Raw } from './read';

// Epoch seconds and epoch milliseconds are both common. Values this large are ms.
function epochMs(value: number): number {
  return value < 1e12 ? value * 1000 : value;
}

// When a pending code expires, in epoch ms. Reads an absolute time first, then a
// count of seconds left. Returns null when the response has neither.
export function expiryOf(raw: Raw, now: number): number | null {
  const absolute = raw.expires_at ?? raw.expires ?? raw.expiry ?? raw.expires_on;
  if (typeof absolute === 'string') {
    const parsed = Date.parse(absolute);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const numeric = numberOf(absolute);
  if (numeric !== null) return epochMs(numeric);
  const secondsLeft = numberOf(raw.expires_in ?? raw.seconds_left ?? raw.ttl_seconds);
  if (secondsLeft !== null) return now + secondsLeft * 1000;
  return null;
}

// A short, readable time for a stored timestamp, such as an approval date.
export function whenText(value: unknown): string | null {
  const text = textOf(value);
  if (!text) return null;
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return text;
  return new Date(parsed).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatTimeLeft(expiresAt: number, now: number): string {
  const seconds = Math.floor((expiresAt - now) / 1000);
  if (seconds <= 0) return 'Expired';
  if (seconds < 60) return 'Under a minute left';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min left`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min left` : `${hours} h left`;
}

// The current time, refreshed on an interval. Used for countdowns.
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
