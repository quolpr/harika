import { computed } from 'mobx';
import { model, Model, modelAction, prop } from 'mobx-keystone';
import { findFirst, isTodo, mapTokens } from '../../../../blockParser/astHelpers';
import { parse } from '../../../../blockParser/blockParser';
import type { Token } from '../../../../blockParser/types';

function assertUnreachable(x: never): never {
  throw new Error("Didn't expect to get here");
}

const astToString = (ast: Token[]): string => {
  return (
    ast
      // eslint-disable-next-line array-callback-return
      .map((t): string => {
        switch (t.type) {
          case 'ref':
            return `[[${t.content}]]`;

          case 'tag':
            return t.withBrackets ? `#[[${t.content}]]` : `#${t.content}`;

          case 'bold':
            return `**${astToString(t.content)}**`;

          case 'italic':
            return `__${astToString(t.content)}__`;

          case 'highlight':
            return `^^${astToString(t.content)}^^`;

          case 'head':
            return `${'#'.repeat(t.depth)}${astToString(t.content)}${
              t.withTrailingEOL ? `\n` : ''
            }`;

          case 'inlineCode':
            return `\`${t.content}\``;
          case 'codeBlock':
            return `\`\`\`${t.content}\`\`\`${t.withTrailingEOL ? `\n` : ''}`;

          case 'str':
            return t.content;

          case 'link':
            return t.content;

          case 'quote':
            return `> ${astToString(t.content)}${
              t.withTrailingEOL ? `\n` : ''
            }`;

          default:
            assertUnreachable(t);
        }
      })
      .join('')
  );
};

@model('harika/BlockContentModel')
export class BlockContentModel extends Model({
  value: prop<string>(),
}) {
  @computed
  get ast() {
    return parse(this.value);
  }

  @computed
  get firstTodoToken() {
    const firstToken = this.ast[0];
    const secondToken = this.ast[1];

    if (isTodo(firstToken)) return firstToken;
    if (
      firstToken.type === 'str' &&
      firstToken.content.trim().length === 0 &&
      isTodo(secondToken)
    )
      return secondToken;

    return undefined;
  }

  getTokenById(tokenId: string) {
    return findFirst(this.ast, ({ id }) => tokenId === id);
  }

  @modelAction
  update(value: string) {
    this.value = value;
  }

  @modelAction
  updateTitle(title: string, newTitle: string) {
    this.value = this.value.split(`[[${title}]]`).join(`[[${newTitle}]]`);
  }

  @modelAction
  toggleTodo(id: string) {
    const newAst = mapTokens(this.ast, (token) => {
      if (token.id === id && token.type === 'ref') {
        const ref = token.ref === 'TODO' ? 'DONE' : 'TODO';
        return {
          ...token,
          content: ref,
          ref,
        };
      }
      return token;
    });

    this.update(astToString(newAst));
  }

  get hasTodo() {
    return Boolean(
      findFirst(
        this.ast,
        (t) => t.type === 'ref' && (t.ref === 'TODO' || t.ref === 'DONE'),
      ),
    );
  }
}
