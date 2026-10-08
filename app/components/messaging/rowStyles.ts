import { StyleSheet } from 'react-native';

import { MONO, tokens } from '@/constants/tokens';

// Shared row styles for the channel, pairing and webhook lists. They match the Row
// component in components/ui so these lists look like the rest of the Control screens.
export const rowStyles = StyleSheet.create({
  item: { paddingHorizontal: 14, paddingVertical: 12, gap: 10, minHeight: 48 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.line },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { flex: 1, gap: 2 },
  name: { color: tokens.text, fontSize: 15 },
  sub: { color: tokens.textMuted, fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spacer: { flex: 1 },
  mono: { color: tokens.text, fontFamily: MONO, fontSize: 13 },
  result: { fontSize: 13, lineHeight: 18 },
});
