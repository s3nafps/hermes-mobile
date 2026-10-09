import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { TabItems, type TabItemsProps } from '@/components/navigation/TabItems';
import { tokens } from '@/constants/tokens';

type Props = TabItemsProps & {
  // Height of the keyboard. The button sits above it.
  keyboardHeight: number;
  // Extra space kept above the keyboard, for example to clear the chat composer.
  lift: number;
};

const BUTTON_SIZE = 52;
const MENU_GAP = 12;

// While the keyboard is open, the bottom bar is behind it. This round button stays above
// the keyboard instead. Tapping it opens the same five tabs as a menu, and a tab closes it.
export function FloatingTabs({ keyboardHeight, lift, state, descriptors, navigation }: Props) {
  const [open, setOpen] = useState(false);
  const bottom = keyboardHeight + lift;
  const current = state.routes[state.index];
  const icon = descriptors[current.key].options.tabBarIcon;

  return (
    <>
      {open ? (
        <View style={[styles.menu, { bottom: bottom + BUTTON_SIZE + MENU_GAP }]}>
          <TabItems
            state={state}
            descriptors={descriptors}
            navigation={navigation}
            onNavigate={() => setOpen(false)}
          />
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? 'Close tab menu' : 'Open tab menu'}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={[styles.button, { bottom }]}>
        {icon?.({ focused: true, color: tokens.accentText, size: 24 })}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 16,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.accent,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  menu: {
    position: 'absolute',
    left: 14,
    right: 14,
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
});
