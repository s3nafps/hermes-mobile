import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { lift, tokens } from '@/constants/tokens';
import { useChat } from '@/lib/chat/ChatProvider';
import { livePrompts } from '@/lib/chat/reducer';
import { themed } from '@/lib/theme';

export type TabItemsProps = Pick<BottomTabBarProps, 'state' | 'descriptors' | 'navigation'> & {
  // Runs after a tab is chosen, so a menu can close itself.
  onNavigate?: () => void;
};

// Height of the capsule shared by the bottom bar and the menu above the keyboard.
export const CAPSULE_HEIGHT = 64;

// The Chat tab is the index route. It carries the approval badge.
const CHAT_ROUTE = 'index';

// The capsule look: a surface pill with the card border and a float lift. The bottom bar and
// the keyboard menu both use it, so they stay in step.
export const capsuleStyles = themed(() => StyleSheet.create({
  shell: {
    flexDirection: 'row',
    gap: 4,
    height: CAPSULE_HEIGHT,
    padding: 6,
    borderRadius: CAPSULE_HEIGHT / 2,
    borderWidth: 1,
    borderColor: tokens.line,
    backgroundColor: tokens.surface,
    ...lift('float'),
  },
}));

// Approval prompts still open on the gateway. Each one lapses after its window, so while any
// approval is open the count re-checks once a second.
function useApprovalCount(): number {
  const { state } = useChat();
  const hasApproval = state.prompts.some((prompt) => prompt.kind === 'approval');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!hasApproval) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasApproval]);

  return livePrompts(state.prompts, now).filter((prompt) => prompt.kind === 'approval').length;
}

// The five tab buttons. Shared by the bottom bar and the floating menu above the keyboard.
export function TabItems({ state, descriptors, navigation, onNavigate }: TabItemsProps) {
  const approvals = useApprovalCount();

  return (
    <>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const color = focused ? tokens.atext : tokens.textMuted;
        const badge = route.name === CHAT_ROUTE ? approvals : 0;

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
            <View>
              {options.tabBarIcon?.({ focused, color, size: 22 })}
              {badge > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              ) : null}
            </View>
            <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.label, { color }]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </>
  );
}

const styles = themed(() => StyleSheet.create({
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 6,
    borderRadius: 999,
  },
  itemActive: {
    backgroundColor: tokens.tint,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.warn,
    borderWidth: 2,
    borderColor: tokens.surface,
  },
  badgeText: {
    color: tokens.onWarn,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
}));
