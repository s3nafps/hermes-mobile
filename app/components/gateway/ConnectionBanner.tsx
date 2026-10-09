import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '@/constants/tokens';
import { useGateway } from '@/lib/gateway';
import { themed } from '@/lib/theme';

// Shown at the top whenever the live channel is down, so screens never look
// current when they are not.
export function ConnectionBanner() {
  const { phase, rpc, rpcStatus, activeProfile } = useGateway();
  const insets = useSafeAreaInsets();
  if (phase !== 'online' || rpcStatus === 'open') return null;
  const name = activeProfile?.name ?? 'the gateway';
  return (
    <View accessibilityLiveRegion="polite" style={[styles.strip, { paddingTop: insets.top + 6 }]}>
      <View style={styles.row}>
        <Text style={styles.title}>Reconnecting to {name}…</Text>
        <Pressable onPress={() => rpc?.wake()} accessibilityRole="button" accessibilityLabel="Reconnect now" hitSlop={8} style={styles.action}>
          <Text style={styles.actionText}>Reconnect now</Text>
        </Pressable>
      </View>
      <Text style={styles.note}>Live updates pause until the connection returns.</Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  strip: {
    paddingBottom: 8,
    paddingHorizontal: 16,
    gap: 4,
    backgroundColor: tokens.surface,
    borderBottomWidth: 2,
    borderBottomColor: tokens.warn,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    flex: 1,
    color: tokens.text,
    fontSize: 15,
    fontWeight: '600',
  },
  action: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  actionText: {
    color: tokens.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  note: {
    color: tokens.textMuted,
    fontSize: 13,
  },
}));
