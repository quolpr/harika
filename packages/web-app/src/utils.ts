import { withNaming } from '@bem-react/classname';
import { useRef } from 'react';
import { isEqual } from 'lodash-es';
import type { ErrorOption } from 'react-hook-form';
import type { ValidationMessage } from './generated/graphql';

export const cn = withNaming({ n: '', e: '__', m: '--', v: '_' });

export const isIOS =
  typeof window.navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(window.navigator.userAgent || '') ||
    (window.navigator.platform === 'MacIntel' &&
      window.navigator.maxTouchPoints > 1));

export const insertText = (
  el: HTMLTextAreaElement,
  text: string,
  cursorPos = text.length,
  insertPos?: { start: number; end: number },
) => {
  // https://stackoverflow.com/questions/23892547/what-is-the-best-way-to-trigger-onchange-event-in-react-js
  const nativeInputValueSetter = Object?.getOwnPropertyDescriptor(
    window?.HTMLTextAreaElement?.prototype,
    'value',
  )?.set;

  const set = (text: string) => nativeInputValueSetter?.call(el, text);

  if (el.selectionStart || el.selectionStart === 0) {
    const startPos = insertPos ? insertPos.start : el.selectionStart;
    const endPos = insertPos ? insertPos.end : el.selectionEnd;

    set(
      el.value.substring(0, startPos) +
        text +
        el.value.substring(endPos, el.value.length),
    );

    el.selectionStart = startPos + cursorPos;
    el.selectionEnd = startPos + cursorPos;
  } else {
    set(el.value + text);
  }

  const ev = new Event('input', { bubbles: true });
  el.dispatchEvent(ev);
};

export function setServerErrors<T>(
  errors: Pick<ValidationMessage, 'field' | 'message'>[],
  setError: (fieldName: keyof T, error: ErrorOption) => void,
) {
  errors.forEach(({ field, message }) => {
    setError(field as keyof T, { type: 'server', message });
  });
}

export function useDeepMemo<TKey, TValue>(
  memoFn: () => TValue,
  key: TKey,
): TValue {
  const ref = useRef<{ key: TKey; value: TValue }>();

  if (!ref.current || !isEqual(key, ref.current.key)) {
    ref.current = { key, value: memoFn() };
  }

  return ref.current.value;
}
