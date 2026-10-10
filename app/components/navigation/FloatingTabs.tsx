import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { capsuleStyles, TabItems, type TabItemsProps } from '@/components/navigation/TabItems';
import { lift, tokens } from '@/constants/tokens';
import { themed } from '@/lib/theme';

type Props = TabItemsProps & {
  // Distance from the screen bottom to the top of the keyboard. The button sits right above it.
  keyboardHeight: number;
  // Gap between the keyboard and the button.
  lift: number;
};

const BUTTON_SIZE = 52;
const MENU_GAP = 12;

// While the keyboard is open, the bottom bar is behind it. This round button stays right above
// the keyboard instead, on the right. Tapping it opens the same five tabs as a menu, and a tab closes it.
export function FloatingTabs({ keyboardHeight, lift: gap, state, descriptors, navigation }: Props) {
  const [open, setOpen] = useState(false);
  const bottom = keyboardHeight + gap;
  const current = state.routes[state.index];
  const icon = descriptors[current.key].options.tabBarIcon;

  return (
    <>
      {open ? (
        <View style={[capsuleStyles.shell, styles.menu, { bottom: bottom + BUTTON_SIZE + MENU_GAP }]}>
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

const styles = themed(() => StyleSheet.create({
  button: {
    position: 'absolute',
    right: 16,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.accent,
    ...lift('float'),
  },
  menu: {
    position: 'absolute',
    left: 14,
    right: 14,
  },
}));
