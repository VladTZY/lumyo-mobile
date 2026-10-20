import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

// Whether the software keyboard is up. iOS reports the will* events early
// enough for layout to move with the keyboard; Android only has the did*
// pair. Web has no keyboard events, so it is always false there.
export function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setShown(true));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setShown(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return shown;
}
