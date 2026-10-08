import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { MONO, tokens } from '@/constants/tokens';

// Long diffs are cut off here so the screen stays responsive on a phone.
const MAX_LINES = 600;

type LineKind = 'add' | 'remove' | 'hunk' | 'meta' | 'context';

function kindOf(line: string): LineKind {
  if (line.startsWith('+++') || line.startsWith('---')) return 'meta';
  if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('\\')) return 'meta';
  if (line.startsWith('@@')) return 'hunk';
  if (line.startsWith('+')) return 'add';
  if (line.startsWith('-')) return 'remove';
  return 'context';
}

const LINE_COLORS: Record<LineKind, { bg: string; fg: string }> = {
  add: { bg: 'rgba(123, 211, 137, 0.14)', fg: tokens.done },
  remove: { bg: 'rgba(240, 115, 107, 0.14)', fg: tokens.danger },
  hunk: { bg: tokens.surfaceRaised, fg: tokens.info },
  meta: { bg: 'transparent', fg: tokens.textMuted },
  context: { bg: 'transparent', fg: tokens.text },
};

// Monospace unified diff. Added and removed lines are colored. Scrolls sideways for long lines.
export function DiffView({ diff }: { diff: string }) {
  if (!diff.trim()) {
    return <Text style={styles.note}>No text changes to show. The file may be binary.</Text>;
  }
  const all = diff.replace(/\n$/, '').replace(/\r/g, '').split('\n');
  const lines = all.slice(0, MAX_LINES);
  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          {lines.map((line, index) => {
            const color = LINE_COLORS[kindOf(line)];
            return (
              <View key={index} style={[styles.line, { backgroundColor: color.bg }]}>
                <Text style={[styles.code, { color: color.fg }]}>{line || ' '}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
      {all.length > MAX_LINES ? (
        <Text style={styles.note}>
          Showing the first {MAX_LINES} of {all.length} lines.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  line: { paddingHorizontal: 8 },
  code: { fontFamily: MONO, fontSize: 12, lineHeight: 17 },
  note: { color: tokens.textMuted, fontSize: 13, lineHeight: 18 },
});
