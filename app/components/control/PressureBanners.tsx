import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '@/constants/tokens';
import { themed } from '@/lib/theme';

import { percent } from './format';
import type { SystemStats } from './types';

// Warn well before a host runs out of memory or disk space.
const WARN_AT = 80;
const DANGER_AT = 90;

type Props = {
  stats: SystemStats | null | undefined;
};

// Shows a notice for each resource on the gateway host that is running high.
export function PressureBanners({ stats }: Props) {
  if (!stats) return null;
  const items = [
    { name: 'Memory', value: stats.memory?.percent, hint: 'Close unused sessions or restart the gateway.' },
    { name: 'Disk', value: stats.disk?.percent, hint: 'Free up space on the gateway host.' },
  ];
  return (
    <>
      {items.map((item) => {
        if (typeof item.value !== 'number' || item.value < WARN_AT) return null;
        const color = item.value >= DANGER_AT ? tokens.danger : tokens.warn;
        return (
          <View key={item.name} style={[styles.banner, { borderColor: color }]}>
            <View style={[styles.edge, { backgroundColor: color }]} />
            <Text style={styles.text}>{`${item.name} is at ${percent(item.value)} on the gateway host. ${item.hint}`}</Text>
          </View>
        );
      })}
    </>
  );
}

const styles = themed(() => StyleSheet.create({
  banner: {
    flexDirection: 'row',
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  edge: { width: 4 },
  text: { flex: 1, color: tokens.text, fontSize: 15, lineHeight: 21, padding: 14 },
}));
