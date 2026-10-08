import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '@/constants/tokens';
import { useGateway } from '@/lib/gateway';

// Shown at the top whenever the live channel is down, so screens never look
// current when they are not.
export function ConnectionBanner() {
  const { phase, rpcStatus, activeProfile } = useGateway();
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
        backgroundColor: tokens.surfaceRaised,
        borderBottomWidth: 1,
        borderBottomColor: tokens.accent,
      }}>
      <Text style={{ color: tokens.text, fontSize: 13, fontWeight: '600' }}>Reconnecting to {name}…</Text>
      <Text style={{ color: tokens.textMuted, fontSize: 12 }}>Live updates pause until the connection returns.</Text>
    </View>
  );
}
