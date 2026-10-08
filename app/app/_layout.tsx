import { DarkTheme, Stack, ThemeProvider, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { tokens } from '@/constants/tokens';
import { GatewayProvider, useGateway } from '@/lib/gateway';

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

// The approved design is dark only in v1, so the theme does not follow the system setting.
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={DarkTheme}>
        <GatewayProvider>
          <Gate />
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

  if (phase === 'loading') return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: tokens.bg },
        headerTintColor: tokens.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: tokens.bg },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="connect" options={{ headerShown: false }} />
    </Stack>
  );
}
