import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '@/constants/tokens';

type Props = {
  label: string;
  value: string;
};

// One figure in a grid of totals.
export function StatTile({ label, value }: Props) {
  return (
    <View style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '48%',
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.line,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  label: { color: tokens.textMuted, fontSize: 12 },
  value: { color: tokens.text, fontSize: 22, fontWeight: '600' },
});
