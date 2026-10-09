import type { ViewStyle } from 'react-native';
import { Platform } from 'react-native';

// Layered-glass palettes (design direction B): cool neutrals, an indigo accent, and cards that lift
// off the page. The names are shared by both themes, so a component reads the same token either way.
export type Scheme = 'light' | 'dark';

export type Palette = {
  bg: string; // page background
  surface: string; // cards, composer, sheets
  surfaceRaised: string; // a card on a card, such as a code block's container
  well: string; // sunken fills: chips, code, toggles off
  line: string; // hairlines and card borders
  text: string;
  textMuted: string;
  accent: string;
  accentText: string; // text on the accent colour
  atext: string; // accent used as text on the page
  tint: string; // accent at low strength, for user bubbles and the active tab
  running: string;
  done: string;
  danger: string;
  warn: string;
  warnText: string; // warning text on the page
  onWarn: string; // text on a solid warning fill
  info: string;
};

export const palettes: Record<Scheme, Palette> = {
  light: {
    bg: '#EEF2F8',
    surface: '#FFFFFF',
    surfaceRaised: '#F5F7FB',
    well: '#E3E8F1',
    line: '#DDE2EC',
    text: '#0F1420',
    textMuted: '#5B6478',
    accent: '#4B5EF0',
    accentText: '#FFFFFF',
    atext: '#3A4BD6',
    tint: 'rgba(75,94,240,0.14)',
    running: '#4B5EF0',
    done: '#1D9A66',
    danger: '#C2352B',
    warn: '#B45309',
    warnText: '#8A5A00',
    onWarn: '#FFFFFF',
    info: '#3A4BD6',
  },
  dark: {
    bg: '#0A0D14',
    surface: '#1B2232',
    surfaceRaised: '#232B3D',
    well: '#2A3246',
    line: '#2E3649',
    text: '#EDF1FA',
    textMuted: '#8D96A8',
    accent: '#8E9BFF',
    accentText: '#0A0D14',
    atext: '#8E9BFF',
    tint: 'rgba(142,155,255,0.16)',
    running: '#8E9BFF',
    done: '#3FD39A',
    danger: '#FF7B6B',
    warn: '#F5B955',
    warnText: '#F5B955',
    onWarn: '#1A1205',
    info: '#8E9BFF',
  },
};

// The live palette. Screens read these values while they render. applyScheme swaps them in place.
export const tokens: Palette = { ...palettes.dark };

let scheme: Scheme = 'dark';

export function currentScheme(): Scheme {
  return scheme;
}

export function applyScheme(next: Scheme): void {
  scheme = next;
  Object.assign(tokens, palettes[next]);
}

// Soft lift for raised surfaces. Light mode gets a shadow. Dark mode gets none, because the
// border carries the edge there. Call it inside a themed() builder so it follows the scheme in use.
export function lift(strength: 'card' | 'float' = 'card'): ViewStyle {
  if (scheme === 'dark') return {};
  if (strength === 'float') {
    return { shadowColor: '#0F1420', shadowOpacity: 0.12, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 6 };
  }
  return { shadowColor: '#0F1420', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 };
}

// Monospace family for commands, paths and logs. Each platform has its own name.
export const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string;
