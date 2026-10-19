import { useKeyboardState } from 'react-native-keyboard-controller';

/**
 * Live keyboard height in screen pixels (0 when hidden).
 *
 * React Native's own Android `Keyboard` events report the wrong height on
 * several devices (facebook/react-native#26461) and, since Android 15/16 enforces
 * edge-to-edge (Expo SDK 58 targets API 36), `adjustResize` no longer
 * resizes the window at all — RN's `KeyboardAvoidingView` can't help either.
 *
 * `react-native-keyboard-controller` tracks the real IME inset through the
 * WindowInsets API and is the setup Expo documents as the reliable path, so
 * this hook is a thin selector over its state. Both the chat screen and the
 * composer pad themselves with this value.
 */
export function useKeyboardHeight(): number {
  return useKeyboardState((state) => (state.isVisible ? state.height : 0));
}
