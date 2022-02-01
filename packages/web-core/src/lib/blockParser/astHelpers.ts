import type { TodoRefToken, Token } from './types';

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
      filterAst(t.content, filter, result);
    }
  });

  return result;
};

export const findFirst = (
  tokens: Token[],
  finder: (t: Token) => boolean,
): Token | undefined => {
  for (const token of tokens) {
    if (finder(token)) return token;

    if (Array.isArray(token.content)) {
      const nestedFindResult = findFirst(token.content, finder);

      if (nestedFindResult) return nestedFindResult;
    }
  }

  return undefined;
};

export const mapTokens = (
  tokens: Token[],
  mapper: (t: Token) => Token | Token[],
): Token[] => {
  return tokens.flatMap((t): Token | Token[] => {
    const mapResult = mapper(t);
    // Let's clone object to not mutate original
    const mapped = Array.isArray(mapResult) ? mapResult : { ...mapResult };

    if (Array.isArray(mapped)) {
      return mapTokens(mapped, mapper);
    }

    if (Array.isArray(mapped.content)) {
      mapped.content = mapTokens(mapped.content, mapper);

      return mapped;
    }

    return mapped;
  });
};

export const isTodo = (token: Token): token is TodoRefToken => {
  return token.type === 'noteBlockRef' && ['TODO', 'DONE'].includes(token.ref);
};
