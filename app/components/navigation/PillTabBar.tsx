import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '@/constants/tokens';

// Floating pill with the five tabs. It is laid out below the screens, not on top of
// them, so the chat composer and the last list rows never sit underneath it.
export function PillTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) + 4 }]}>
      <View style={styles.pill}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
