import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingTabs } from '@/components/navigation/FloatingTabs';
import { capsuleStyles, TabItems } from '@/components/navigation/TabItems';
import { tokens } from '@/constants/tokens';
import { themed } from '@/lib/theme';

export type PillTabBarProps = BottomTabBarProps & {
  // Height of the keyboard, or 0 while it is hidden.
  keyboardHeight: number;
  // Gap between the keyboard and the floating button.
  lift: number;
};

// Floating capsule with the five tabs, 14px above the bottom safe area. It is laid out below the
// screens, so they never sit under it. When the keyboard covers it, a floating button takes its
// place above the keyboard.
export function PillTabBar({ keyboardHeight, lift, state, descriptors, navigation }: PillTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + 14 }]}>
      <View style={capsuleStyles.shell}>
        <TabItems state={state} descriptors={descriptors} navigation={navigation} />
      </View>
      {keyboardHeight > 0 ? (
        <FloatingTabs
          keyboardHeight={keyboardHeight}
          lift={lift}
          state={state}
          descriptors={descriptors}
          navigation={navigation}
        />
      ) : null}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  wrap: {
    backgroundColor: tokens.bg,
    paddingHorizontal: 14,
  },
}));
