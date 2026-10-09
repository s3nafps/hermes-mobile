import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '@/constants/tokens';
import { useGateway } from '@/lib/gateway';

// Shown at the top whenever the live channel is down, so screens never look
// current when they are not.
export function ConnectionBanner() {
  const { phase, rpc, rpcStatus, activeProfile } = useGateway();
  const insets = useSafeAreaInsets();
  if (phase !== 'online' || rpcStatus === 'open') return null;
  const name = activeProfile?.name ?? 'the gateway';
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        paddingTop: insets.top + 6,
        paddingBottom: 8,
        paddingHorizontal: 16,
        gap: 2,
        backgroundColor: tokens.surfaceRaised,
        borderBottomWidth: 1,
        borderBottomColor: tokens.accent,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ color: tokens.text, fontSize: 13, fontWeight: '600', flex: 1 }}>Reconnecting to {name}…</Text>
        <Pressable onPress={() => rpc?.wake()} accessibilityRole="button" accessibilityLabel="Reconnect now" hitSlop={8}>
          <Text style={{ color: tokens.accent, fontSize: 13, fontWeight: '600' }}>Reconnect now</Text>
        </Pressable>
      </View>
      <Text style={{ color: tokens.textMuted, fontSize: 12 }}>Live updates pause until the connection returns.</Text>
    </View>
  );
}
