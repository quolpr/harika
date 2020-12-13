import { useRef, useEffect } from 'react';
import { Animated, Keyboard, KeyboardEvent } from 'react-native';

export const useKeyboardHeight = (initial = 0, additional = 0) => {
  const keyboardHeight = useRef(new Animated.Value(initial + additional))
    .current;

  useEffect(() => {
    const keyboardWillShow = (e: KeyboardEvent) => {
      Animated.timing(keyboardHeight, {
        duration: e.duration,
        toValue: e.endCoordinates.height + additional,
        useNativeDriver: false,
      }).start();
    };

    const keyboardWillHide = (e: KeyboardEvent) => {
      Animated.timing(keyboardHeight, {
        duration: e.duration,
        toValue: initial + additional,
        useNativeDriver: false,
      }).start();
    };

    const keyboardWillShowSub = Keyboard.addListener(
      'keyboardWillShow',
      keyboardWillShow
    );
    const keyboardWillHideSub = Keyboard.addListener(
      'keyboardWillHide',
      keyboardWillHide
    );

    return () => {
      keyboardWillHideSub.remove();
      keyboardWillShowSub.remove();
    };
  }, [keyboardHeight, initial, additional]);

  return keyboardHeight;
};
