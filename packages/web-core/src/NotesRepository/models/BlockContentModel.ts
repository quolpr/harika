import { computed } from 'mobx';
import { model, Model, modelAction, prop } from 'mobx-keystone';
import { parse } from '../../blockParser/blockParser';
import type { Token } from '../../blockParser/types';
import produce from 'immer';

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
    this.value.split(`[[${title}]]`).join(`[[${newTitle}]]`);
  }

  @modelAction
  toggleTodo(id: string) {
    const newAst = produce(this.ast, (ast) => {
      findById(ast, id, (t) => {
        t.content = t.content === 'TODO' ? 'DONE' : 'TODO';
      });
    });

    this.update(astToString(newAst));
  }
}
