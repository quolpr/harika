import { withNaming } from '@bem-react/classname';

export const cn = withNaming({ n: '', e: '__', m: '--', v: '_' });

export const isIOS =
  typeof window.navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(window.navigator.userAgent || '') ||
    (window.navigator.platform === 'MacIntel' &&
      window.navigator.maxTouchPoints > 1));
