import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

import { ConnectionBanner } from '@/components/gateway/ConnectionBanner';
import { tokens } from '@/constants/tokens';

const ICON = {
  index: { ios: 'bubble.left.and.bubble.right', android: 'chat', web: 'chat' },
  bots: { ios: 'person.2', android: 'group', web: 'group' },
  inbox: { ios: 'tray', android: 'inbox', web: 'inbox' },
  tasks: { ios: 'checklist', android: 'checklist', web: 'checklist' },
  control: { ios: 'slider.horizontal.3', android: 'tune', web: 'tune' },
} as const;

export default function TabLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <ConnectionBanner />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: tokens.accent,
          tabBarInactiveTintColor: tokens.textMuted,
          tabBarStyle: { backgroundColor: tokens.surface, borderTopColor: tokens.line },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Chat',
            tabBarIcon: ({ color }) => <SymbolView name={ICON.index} tintColor={color} size={26} />,
          }}
        />
        <Tabs.Screen
          name="bots"
          options={{
            title: 'Bots',
            tabBarIcon: ({ color }) => <SymbolView name={ICON.bots} tintColor={color} size={26} />,
          }}
        />
        <Tabs.Screen
          name="inbox"
          options={{
            title: 'Inbox',
            tabBarIcon: ({ color }) => <SymbolView name={ICON.inbox} tintColor={color} size={26} />,
          }}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: 'Tasks',
            tabBarIcon: ({ color }) => <SymbolView name={ICON.tasks} tintColor={color} size={26} />,
          }}
        />
        <Tabs.Screen
          name="control"
          options={{
            title: 'Control',
            tabBarIcon: ({ color }) => <SymbolView name={ICON.control} tintColor={color} size={26} />,
          }}
        />
      </Tabs>
    </View>
  );
}
