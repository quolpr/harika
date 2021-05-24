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
