import { computed } from 'mobx';
import { model, Model, modelAction, prop } from 'mobx-keystone';
import { mapTokens } from '../../blockParser/astHelpers';
import { parse } from '../../blockParser/blockParser';
import type { Token } from '../../blockParser/types';

const findById = (
  ast: Token[],
  id: string,
  func: (t: Token) => void,
): boolean => {
  return ast.some((t) => {
    if (t.id === id) {
      func(t);

      return true;
    }

    if (Array.isArray(t.content)) {
      return findById(t.content, id, func);
    }

    return false;
  });
};

function assertUnreachable(x: never): never {
  throw new Error("Didn't expect to get here");
}

const astToString = (ast: Token[]): string => {
  return ast
    .map((t): string => {
      switch (t.type) {
        case 'ref':
          return `[[${t.content}]]`;

        case 'tag':
          return `#[[${t.content}]]`;

        case 'bold':
          return `**${astToString(t.content)}**`;

        case 'italic':
          return `__${astToString(t.content)}__`;

        case 'highlight':
          return `^^${astToString(t.content)}^^`;

        case 'head':
          return `${'#'.repeat(t.depth)}${astToString(t.content)}`;

        case 'inlineCode':
          return `\`${t.content}\``;
        case 'codeBlock':
          return `\`\`\`${t.content}\`\`\``;

        case 'str':
          return t.content;

        case 'link':
          return t.content;

        default:
          assertUnreachable(t);
      }
    })
    .join('');
};

@model('harika/ContentManagerModel')
export class BlockContentModel extends Model({
  value: prop<string>(),
}) {
  @computed
  get ast() {
    return parse(this.value);
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
        return {
          ...token,
          content: token.content === 'TODO' ? 'DONE' : 'TODO',
        };
      }
      return token;
    });

    this.update(astToString(newAst));
  }
}
