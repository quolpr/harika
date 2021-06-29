import { mapTokens } from './astHelpers';
import { parse as pegParse } from './pegParser';
import { find, FindResultHash } from 'linkifyjs';
import type { Token } from './types';

declare module 'linkifyjs' {
  interface FindResultHash {
    end: number;
    start: number;
  }
}

const newIdGenerator = () => {
  let id = 0;

  return function () {
    // Math.random should be unique because of its seeding algorithm.
    // Convert it to base 36 (numbers + letters), and grab the first 9 characters
    // after the decimal.
    return (id++).toString();
  };
};

export const parse = (data: string, idGenerator = newIdGenerator): Token[] => {
  const generateId = idGenerator();

  return mapTokens(pegParse(data, { generateId }), (t) => {
    if (t.type === 'str') {
      const links = find(t.content);

      if (links.length > 0) {
        const newTokens: Token[] = [];

        let prevLink: FindResultHash | undefined = undefined;

        links.forEach((link, i) => {
          const strTokenPos = {
            offsetStart: prevLink ? prevLink.end : 0,
            offsetEnd: link.start,
          };

          if (strTokenPos.offsetStart !== strTokenPos.offsetEnd) {
            newTokens.push({
              id: generateId(),
              type: 'str',
              content: t.content.slice(
                strTokenPos.offsetStart,
                strTokenPos.offsetEnd,
              ),
              ...strTokenPos,
            });
          }

          newTokens.push({
            id: generateId(),
            type: 'link',
            linkType: link.type,
            content: link.value,
            href: link.href,
            offsetStart: link.start,
            offsetEnd: link.end,
          });

          if (i === links.length - 1 && link.end !== t.content.length) {
            newTokens.push({
              id: generateId(),
              type: 'str',
              content: t.content.slice(link.end),
              offsetStart: link.end,
              offsetEnd: t.content.length,
            });
          }

          prevLink = link;
        });

        return newTokens;
      } else {
        return t;
      }
    }

    return t;
  });
};
