import { mapTokens } from './astHelpers';
import { parse as pegParse } from './pegParser';
import { find, FindResultHash } from 'linkifyjs';
import type { Token } from './types';
import { generateId } from '@harika/common';

export const parse = (data: string): Token[] => {
  return mapTokens(pegParse(data), (t) => {
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
