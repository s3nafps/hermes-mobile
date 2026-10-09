import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';

// Distance in points from the bottom of the screen to the top of the on-screen keyboard,
// or 0 while it is hidden. Measured from the screen edge, so the Android navigation bar
// below the keyboard is counted. The keyboard's own height leaves it out.
export function useKeyboardHeight(): number {
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    // iOS reports the change before it animates, Android once it has finished.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => {
      const { screenY, height } = event.endCoordinates;
      const screenHeight = Dimensions.get('screen').height;
      setDistance(screenY > 0 ? screenHeight - screenY : height);
    });
    const hide = Keyboard.addListener(hideEvent, () => setDistance(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return distance;
}
