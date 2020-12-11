import { useCallback, useState } from 'react';

export const useIsFocused = (): [
  isFocused: boolean,
  callbacks: {
    onBlur(): void;
    onFocus(): void;
  }
] => {
  const [isFocused, setIsFocused] = useState(false);

  const onBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  const onFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  return [isFocused, { onBlur, onFocus }];
};
