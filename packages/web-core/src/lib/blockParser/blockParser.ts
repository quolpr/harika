import { mapTokens } from './astHelpers';
import { parse as pegParse } from './pegParser';
import { find } from 'linkifyjs';
import type { Token } from './types';
import { dictionary } from '../generateId';
import { ValuesType } from 'utility-types';

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

        let prevLink: ValuesType<ReturnType<typeof find>> | undefined =
          undefined;

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

        return newTokens.map((token) => ({
          ...token,
          offsetStart: t.offsetStart + token.offsetStart,
          offsetEnd: t.offsetStart + token.offsetEnd,
        }));
      } else {
        return t;
      }
    } else if (t.type === 'noteBlockRef') {
      let [ref, alias] = t.content.split('|', 2) as [
        string,
        string | undefined,
      ];

      ref = ref.trim();
      alias = alias?.trim();

      return { ...t, ref: ref, alias: alias?.length === 0 ? undefined : alias };
    } else if (t.type === 'textBlockRef') {
      const matchResult = t.content.match(
        new RegExp(`^~([${dictionary}]{20})$`),
      );

      const [, id] = matchResult || [];

      return { ...t, blockId: id };
    }

    return t;
  });
};
