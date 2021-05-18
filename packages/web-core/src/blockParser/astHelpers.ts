import type { Token } from './types';

export const filterAst = (
  tokens: Token[],
  filter: (t: Token) => boolean,
  result: Token[] = [],
) => {
  tokens.forEach((t) => {
    if (filter(t)) {
      result.push(t);
    }

    if (Array.isArray(t.content)) {
      filterAst(tokens, filter, result);
    }
  });

  return result;
};
