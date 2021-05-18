import type { Token } from '@harika/web-core';

export const getTokensAtCursor = (
  pos: number,
  tokens: Token[],
  tokensAtPos: Token[] = [],
) => {
  tokens.forEach((t) => {
    if (t.offsetStart < pos && pos < t.offsetEnd) {
      tokensAtPos.push(t);
    }

    if (Array.isArray(t.content)) {
      getTokensAtCursor(pos, t.content, tokensAtPos);
    }
  });

  return tokensAtPos;
};
