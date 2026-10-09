import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { tokens } from '@/constants/tokens';
import { themed } from '@/lib/theme';

type Props = {
  name: string;
  kind: 'image' | 'file';
  // This device's copy of a photo. Shown as a thumbnail when present.
  previewUri?: string;
  status?: 'uploading' | 'ready' | 'failed';
  error?: string;
  onRemove?: () => void;
};

const ICON = {
  image: { ios: 'photo', android: 'image', web: 'image' },
  file: { ios: 'doc', android: 'description', web: 'description' },
} as const;

// A photo or file, shown above the composer or inside a sent message. A photo shows as a 56px thumbnail.
export function AttachmentChip({ name, kind, previewUri, status = 'ready', error, onRemove }: Props) {
  const failed = status === 'failed';
  const uploading = status === 'uploading';
  return (
    <View style={[styles.chip, failed && styles.chipFailed, onRemove ? null : styles.chipBare]}>
      <View style={styles.lead}>
        {previewUri && !failed ? (
          <Image source={{ uri: previewUri }} style={styles.thumb} accessibilityIgnoresInvertColors />
        ) : (
          <SymbolView name={ICON[kind]} tintColor={failed ? tokens.danger : tokens.textMuted} size={22} />
        )}
        {uploading ? (
          <View style={styles.progress}>
            <ActivityIndicator color={tokens.text} />
          </View>
        ) : null}
      </View>
      <View style={styles.text}>
        <Text numberOfLines={1} style={styles.name}>
          {name}
        </Text>
        {uploading ? <Text style={styles.status}>Uploading…</Text> : null}
        {failed ? (
          <Text numberOfLines={2} style={[styles.status, { color: tokens.danger }]}>
            {error ?? 'Could not attach'}
          </Text>
        ) : null}
      </View>
      {onRemove ? (
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove ${name}`} style={styles.removeTarget}>
          <Text style={styles.remove}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 260,
    paddingLeft: 3,
    paddingRight: 4,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.line,
    backgroundColor: tokens.surface,
  },
  chipBare: {
    paddingRight: 14,
  },
  chipFailed: {
    borderColor: tokens.danger,
  },
  lead: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.well,
  },
  thumb: {
    width: 56,
    height: 56,
    backgroundColor: tokens.well,
  },
  progress: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.bg,
    opacity: 0.6,
  },
  text: {
    flexShrink: 1,
    gap: 2,
  },
  name: {
    color: tokens.text,
    fontSize: 13,
    fontWeight: '500',
  },
  status: {
    color: tokens.textMuted,
    fontSize: 13,
  },
  removeTarget: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: {
    color: tokens.textMuted,
    fontSize: 20,
    lineHeight: 22,
  },
}));
