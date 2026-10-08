import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '@/constants/tokens';

type Props = {
  title: string;
  // Screens from design/canvas that this tab will hold.
  screens: string[];
};

// Stand-in for a tab until its screens are built from the approved design.
export function PlaceholderScreen({ title, screens }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.label}>Designed screens</Text>
      {screens.map((name) => (
        <Text key={name} style={styles.item}>
          {name}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.bg,
    paddingTop: 24,
    paddingHorizontal: 20,
    gap: 8,
  },
  title: {
    color: tokens.text,
    fontSize: 24,
    fontWeight: '600',
  },
  label: {
    color: tokens.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 12,
  },
  item: {
    color: tokens.text,
    fontSize: 15,
    lineHeight: 22,
  },
});
