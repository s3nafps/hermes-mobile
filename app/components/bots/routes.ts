import type { Href } from 'expo-router';

// Route builders for the Bots screens. Names are profile names, so they are encoded.

export function botHref(name: string): Href {
  return `/bots/${encodeURIComponent(name)}` as Href;
}

export function botNewHref(): Href {
  return '/bots/new' as Href;
}

export const BOTS_TAB_HREF = '/(tabs)/bots' as Href;
