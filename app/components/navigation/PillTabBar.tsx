import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingTabs } from '@/components/navigation/FloatingTabs';
import { TabItems } from '@/components/navigation/TabItems';
import { tokens } from '@/constants/tokens';
import { themed } from '@/lib/theme';

export type PillTabBarProps = BottomTabBarProps & {
  // Height of the keyboard, or 0 while it is hidden.
  keyboardHeight: number;
  // Gap between the keyboard and the floating button.
  lift: number;
};

// Floating pill with the five tabs. It is laid out below the screens, so they never sit
// under it. When the keyboard covers it, a floating button takes its place above the keyboard.
export function PillTabBar({ keyboardHeight, lift, state, descriptors, navigation }: PillTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) + 4 }]}>
      <View style={styles.pill}>
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
    paddingTop: 6,
  },
  pill: {
    flexDirection: 'row',
    gap: 4,
    padding: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.line,
    backgroundColor: tokens.surface,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
}));
