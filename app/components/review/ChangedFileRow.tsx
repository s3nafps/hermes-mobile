import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MONO, tokens } from '@/constants/tokens';

import type { ReviewFile, ReviewScope } from './types';

const STATUS_COLORS: Record<string, string> = {
  M: tokens.accent,
  A: tokens.done,
  '?': tokens.done,
  D: tokens.danger,
  U: tokens.danger,
  R: tokens.info,
};

// One changed file: status letter, path, where the change is, and the +/- counts.
export function ChangedFileRow({
  file,
  scope,
  selected,
  last,
  onPress,
}: {
  file: ReviewFile;
  scope: ReviewScope;
  selected: boolean;
  last: boolean;
  onPress: () => void;
}) {
  const where = scope === 'branch' ? 'Branch change' : file.staged ? 'Staged' : 'Not staged';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${file.path}, ${where}, ${file.added} added, ${file.removed} removed`}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.row,
        !last && styles.divider,
        selected && { backgroundColor: tokens.surfaceRaised },
        { opacity: pressed ? 0.7 : 1 },
      ]}>
      <Text style={[styles.status, { color: STATUS_COLORS[file.status] ?? tokens.textMuted }]}>{file.status}</Text>
      <View style={styles.main}>
        <Text style={styles.path} numberOfLines={2}>
          {file.path}
        </Text>
        <Text style={styles.where}>{where}</Text>
      </View>
      <Text style={[styles.count, { color: tokens.done }]}>+{file.added}</Text>
      <Text style={[styles.count, { color: tokens.danger }]}>-{file.removed}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.line },
  status: { width: 16, fontFamily: MONO, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  main: { flex: 1, gap: 2 },
  path: { color: tokens.text, fontFamily: MONO, fontSize: 13 },
  where: { color: tokens.textMuted, fontSize: 12 },
  count: { fontFamily: MONO, fontSize: 13, fontWeight: '600' },
});
