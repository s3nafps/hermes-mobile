import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tokens } from '@/constants/tokens';

type Props = {
  name: string;
  kind: 'image' | 'file';
  status?: 'uploading' | 'ready' | 'failed';
  error?: string;
  onRemove?: () => void;
};

const ICON = {
  image: { ios: 'photo', android: 'image', web: 'image' },
  file: { ios: 'doc', android: 'description', web: 'description' },
} as const;

// A photo or file, shown above the composer or inside a sent message.
export function AttachmentChip({ name, kind, status = 'ready', error, onRemove }: Props) {
  const failed = status === 'failed';
  return (
    <View style={[styles.chip, failed && styles.chipFailed]}>
      <SymbolView name={ICON[kind]} tintColor={failed ? tokens.danger : tokens.textMuted} size={16} />
      <View style={styles.text}>
        <Text numberOfLines={1} style={styles.name}>
          {name}
        </Text>
        {status === 'uploading' ? <Text style={styles.status}>Uploading…</Text> : null}
        {failed ? <Text style={[styles.status, { color: tokens.danger }]}>{error ?? 'Could not attach'}</Text> : null}
      </View>
      {onRemove ? (
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove ${name}`} hitSlop={8}>
          <Text style={styles.remove}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 240,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.line,
    backgroundColor: tokens.surfaceRaised,
  },
  chipFailed: {
    borderColor: tokens.danger,
  },
  text: {
    flexShrink: 1,
  },
  name: {
    color: tokens.text,
    fontSize: 13,
    fontWeight: '500',
  },
  status: {
    color: tokens.textMuted,
    fontSize: 11,
  },
  remove: {
    color: tokens.textMuted,
    fontSize: 18,
    lineHeight: 20,
    paddingHorizontal: 4,
  },
});
