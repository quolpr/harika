import { debounce } from 'lodash-es';
import { computed, observable, reaction } from 'mobx';
import { model, Model, modelAction, prop } from 'mobx-keystone';
import {
  findFirst,
  isTodo,
  mapTokens,
} from '../../../../lib/blockParser/astHelpers';
import { parse } from '../../../../lib/blockParser/blockParser';
import type { Token } from '../../../../lib/blockParser/types';

function assertUnreachable(x: never): never {
  throw new Error("Didn't expect to get here");
}

const astToString = (ast: Token[]): string => {
  return (
    ast
      // eslint-disable-next-line array-callback-return
      .map((t): string => {
        switch (t.type) {
          case 'noteRef':
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

          case 'noteBlockRef':
            return `((${t.content}))`;

          default:
            assertUnreachable(t);
        }
      })
      .join('')
  );
};

@model('harika/noteBlocks/BlockContentModel')
export class BlockContentModel extends Model({
  _value: prop<string>(),
}) {
  // We are debouncing input here to avoid too frequent sync calls with the server + for the better undo/redo
  @observable currentValue = '';

  @computed
  get ast() {
    return parse(this.currentValue);
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
    this.currentValue = value;
  }

  @modelAction
  updateTitle(title: string, newTitle: string) {
    this.currentValue = this.currentValue
      .split(`[[${title}]]`)
      .join(`[[${newTitle}]]`);
  }

  @modelAction
  toggleTodo(id: string) {
    const newAst = mapTokens(this.ast, (token) => {
      if (token.id === id && token.type === 'noteRef') {
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
    this.dumpValue();
  }

  @computed
  get hasTodo() {
    return Boolean(
      findFirst(
        this.ast,
        (t) => t.type === 'noteRef' && (t.ref === 'TODO' || t.ref === 'DONE'),
      ),
    );
  }

  @modelAction
  dumpValue() {
    this._value = this.currentValue;
  }

  @modelAction
  private updatePrivateValue(newVal: string) {
    this._value = newVal;
  }

  onInit() {
    this.currentValue = this._value;

    const debounced = debounce((val: string) => {
      if (val !== this._value) {
        this.updatePrivateValue(val);
      }
    }, 2000);

    const dispose1 = reaction(() => this.currentValue, debounced);
    const dispose2 = reaction(
      () => this._value,
      (val) => {
        if (val !== this.currentValue) {
          this.update(val);
        }
      },
    );

    return () => {
      dispose1();
      dispose2();
    };
  }
}
