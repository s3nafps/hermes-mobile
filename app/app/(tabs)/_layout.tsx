import { SymbolView } from 'expo-symbols';
import { router, usePathname, type Href } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useMemo } from 'react';
import { PanResponder, View } from 'react-native';

import { ConnectionBanner } from '@/components/gateway/ConnectionBanner';
import { PillTabBar } from '@/components/navigation/PillTabBar';
import { useKeyboardHeight } from '@/components/navigation/useKeyboardHeight';
import { tokens } from '@/constants/tokens';

const ICON = {
  index: { ios: 'bubble.left.and.bubble.right', android: 'chat', web: 'chat' },
  bots: { ios: 'person.2', android: 'group', web: 'group' },
  inbox: { ios: 'tray', android: 'inbox', web: 'inbox' },
  tasks: { ios: 'checklist', android: 'checklist', web: 'checklist' },
  control: { ios: 'slider.horizontal.3', android: 'tune', web: 'tune' },
} as const;

// Tab routes in bar order. A horizontal swipe moves one step along this list.
const TAB_PATHS = ['/', '/bots', '/inbox', '/tasks', '/control'] as const;

// Minimum horizontal travel, in points, before a swipe changes tab.
const SWIPE_DISTANCE = 60;

// Space the floating button keeps above the keyboard: the chat composer is about 80 points tall.
const CHAT_COMPOSER_LIFT = 84;
const DEFAULT_LIFT = 16;

export default function TabLayout() {
  const pathname = usePathname();
  const index = TAB_PATHS.indexOf(pathname as (typeof TAB_PATHS)[number]);
  const keyboardHeight = useKeyboardHeight();
  // The Chat tab has its composer at the bottom, so its floating button sits above that.
  const lift = index === 0 ? CHAT_COMPOSER_LIFT : DEFAULT_LIFT;

  // Rebuilt when the tab changes, so a swipe always starts from the tab on screen.
  const swipe = useMemo(
    () =>
      PanResponder.create({
        // Only take over for clearly sideways drags, so vertical scrolling keeps working.
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dx) > 16 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
        onPanResponderRelease: (_, gesture) => {
          if (index < 0 || Math.abs(gesture.dx) < SWIPE_DISTANCE) return;
          const to = index + (gesture.dx < 0 ? 1 : -1);
          if (to < 0 || to >= TAB_PATHS.length) return;
          router.navigate(TAB_PATHS[to] as Href);
        },
      }),
    [index],
  );

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }} {...swipe.panHandlers}>
      <ConnectionBanner />
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => (
          <PillTabBar {...props} keyboardHeight={keyboardHeight} lift={lift} side={index === 0 ? 'left' : 'right'} />
        )}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Chat',
            tabBarIcon: ({ color, size }) => <SymbolView name={ICON.index} tintColor={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="bots"
          options={{
            title: 'Bots',
            tabBarIcon: ({ color, size }) => <SymbolView name={ICON.bots} tintColor={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="inbox"
          options={{
            title: 'Inbox',
            tabBarIcon: ({ color, size }) => <SymbolView name={ICON.inbox} tintColor={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: 'Tasks',
            tabBarIcon: ({ color, size }) => <SymbolView name={ICON.tasks} tintColor={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="control"
          options={{
            title: 'Control',
            tabBarIcon: ({ color, size }) => <SymbolView name={ICON.control} tintColor={color} size={size} />,
          }}
        />
      </Tabs>
    </View>
  );
}
