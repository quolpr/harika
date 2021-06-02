import { omit } from 'lodash-es';

interface ParsedTreeToken {
  spaceCounts: number;
  content: string;
  id?: string;
}

interface TreeToken {
  indent: number;
  content: string;
  id?: string;
}

export const parseStringToTree = (str: string): TreeToken[] => {
  const regex = /^(\s*)-(.*?)(\[#(.*?)\])?$/gm;

  let baseSpaceCount = 0;

  const tokens = [...str.matchAll(regex)].map((group, i): ParsedTreeToken => {
    let [, spaces, content, , id] = group;

    spaces = spaces.replace(/[\n\r]+/g, '');
    content = content.trim();
    id = id?.trim();

    if (i === 0) {
      baseSpaceCount = spaces.length;
    }

    const spaceCounts = spaces.length - baseSpaceCount;

    return { spaceCounts, content, ...(id ? { id } : {}) };
  });

  let currentSpacesPath: number[] = [0];
  let previousToken: undefined | ParsedTreeToken = undefined;

  const withFixedIndent = tokens.map((token): TreeToken => {
    if (previousToken) {
      if (token.spaceCounts > previousToken.spaceCounts) {
        currentSpacesPath.push(token.spaceCounts);
      } else if (token.spaceCounts < previousToken.spaceCounts) {
        currentSpacesPath = [
          ...currentSpacesPath.filter(
            (spaceCounts) => spaceCounts < token.spaceCounts,
          ),
          token.spaceCounts,
        ];
      }
    }

    previousToken = token;

    return {
      ...omit(token, 'spaceCounts'),
      indent: currentSpacesPath.length - 1,
    };
  });

  return withFixedIndent;
};
