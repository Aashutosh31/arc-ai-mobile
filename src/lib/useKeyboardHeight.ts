import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Live keyboard height in screen pixels (0 when hidden).
 *
 * React Native's `KeyboardAvoidingView` relies on the Android window resizing
 * (`adjustResize`), which no longer happens once the app draws edge-to-edge
 * (the default on modern Expo/RN). The composer then sat underneath the
 * keyboard. We listen to the keyboard events directly and pad the composer
 * ourselves, which behaves identically on both platforms.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setHeight(e.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return height;
}
