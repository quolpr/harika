import { withNaming } from '@bem-react/classname';
import { isEqual } from 'lodash-es';
import { useEffect, useRef } from 'react';
import { NavigateFunction, useNavigate } from 'react-router-dom';

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

const modificationsToString = (
  toModify: string,
  modifications: Record<string, boolean>,
) => {
  let tmp = '';

  Object.entries(modifications).forEach(([k, v]) => {
    if (v) {
      // kebab case
      tmp += `${toModify}--${k} `;
    }
  });

  return tmp.trim();
};

export const bem = (block: string) => {
  return (
    elementOrModifications?: string | Record<string, boolean>,
    modifications?: Record<string, boolean>,
  ) => {
    let result = block;

    if (!elementOrModifications) return block;

    if (typeof elementOrModifications !== 'string') {
      return `${result} ${modificationsToString(
        result,
        elementOrModifications,
      )}`;
    } else {
      result += `__${elementOrModifications}`;

      if (modifications) {
        result = `${result} ${modificationsToString(result, modifications)}`;
      }
    }

    return result;
  };
};

export const bemCombine = (...classes: string[]) => {
  return classes.join(' ');
};

export const useNavigateRef = () => {
  const navigate = useNavigate();
  const navRef = useRef<NavigateFunction>(navigate);

  useEffect(() => {
    navRef.current = navigate;
  }, [navigate]);

  return navRef;
};
