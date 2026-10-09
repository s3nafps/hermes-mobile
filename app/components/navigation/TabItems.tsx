import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text } from 'react-native';

import { tokens } from '@/constants/tokens';

export type TabItemsProps = Pick<BottomTabBarProps, 'state' | 'descriptors' | 'navigation'> & {
  // Runs after a tab is chosen, so a menu can close itself.
  onNavigate?: () => void;
};

// The five tab buttons. Shared by the bottom pill and the floating menu above the keyboard.
export function TabItems({ state, descriptors, navigation, onNavigate }: TabItemsProps) {
  return (
    <>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const color = focused ? tokens.accent : tokens.textMuted;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
              onNavigate?.();
            }}
            onLongPress={() => {
              navigation.emit({ type: 'tabLongPress', target: route.key });
            }}
            style={[styles.item, focused && styles.itemActive]}>
            {options.tabBarIcon?.({ focused, color, size: 22 })}
            <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.label, { color }]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 8,
    borderRadius: 999,
  },
  itemActive: {
    backgroundColor: tokens.surfaceRaised,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});
