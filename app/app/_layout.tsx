import { Stack, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { tokens } from '@/constants/tokens';
import { ChatProvider } from '@/lib/chat/ChatProvider';
import { GatewayProvider, useGateway } from '@/lib/gateway';
import { ThemeProvider } from '@/lib/theme';
import { PromptHost } from '@/components/chat/PromptHost';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Start at the tab group so a reload keeps the tab bar.
  initialRouteName: '(tabs)',
};

// Keep the splash up until the saved gateway has been checked.
SplashScreen.preventAutoHideAsync();

// The theme follows the system setting unless the user picks light or dark in Settings.
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <GatewayProvider>
          <ChatProvider>
            <Gate />
          </ChatProvider>
        </GatewayProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// Sends the user to the connect screen unless a gateway is online.
function Gate() {
  const { phase } = useGateway();
  const segments = useSegments();
  const onConnect = segments[0] === 'connect';

  useEffect(() => {
    if (phase === 'loading') return;
    void SplashScreen.hideAsync();
    if (phase === 'online') {
      if (onConnect) router.replace('/(tabs)');
      return;
    }
    if (!onConnect) router.replace('/connect');
  }, [phase, onConnect]);

  // Screens assume a connected gateway, so nothing mounts until the handshake finishes.
  // The connect screen is the only route that renders while connecting.
  if (phase === 'loading' || (phase === 'connecting' && !onConnect)) return null;

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: tokens.bg },
          headerTintColor: tokens.text,
          headerTitleStyle: { color: tokens.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: tokens.bg },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="connect" options={{ headerShown: false }} />
      </Stack>
      <PromptHost />
    </>
  );
}
