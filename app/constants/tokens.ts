import { Platform } from 'react-native';

// Design tokens from design/canvas (Hermes Mobile v1, dark theme only).
export const tokens = {
  bg: '#0B0D10',
  surface: '#14171C',
  surfaceRaised: '#1C2029',
  line: '#2A2F3A',
  text: '#ECEAE4',
  textMuted: '#A9AEB8',
  accent: '#E8B04B',
  accentText: '#1A1408',
  running: '#4FC3B5',
  done: '#7BD389',
  danger: '#F0736B',
  info: '#7AA7F0',
} as const;

// Monospace family for commands, paths and logs. Each platform has its own name.
export const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string;
