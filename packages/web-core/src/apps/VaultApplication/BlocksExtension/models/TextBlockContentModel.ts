import { debounce } from 'lodash-es';
import { action, computed, makeObservable, observable, reaction } from 'mobx';
import {
  findFirst,
  isTodo,
  mapTokens,
} from '../../../../lib/blockParser/astHelpers';
import { parse } from '../../../../lib/blockParser/blockParser';
import type { Token } from '../../../../lib/blockParser/types';
import { TextBlock } from './TextBlock';

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

export class TextBlockContent {
  // We are debouncing input here to avoid too frequent sync calls with the server + for the better undo/redo
  @observable currentValue = '';

  constructor(private textBlock: TextBlock) {
    makeObservable(this);
  }

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

  @action
  update(value: string) {
    this.currentValue = value;
  }

  @action
  updateTitle(title: string, newTitle: string) {
    this.currentValue = this.currentValue
      .split(`[[${title}]]`)
      .join(`[[${newTitle}]]`);
  }

  @action
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

  dumpValue() {
    this.textBlock.setContent(this.currentValue);
  }

  private updatePrivateValue(newVal: string) {
    this.textBlock.setContent(newVal);
  }

  onInit() {
    this.currentValue = this.textBlock.content;

    const debounced = debounce((val: string) => {
      if (val !== this.textBlock.content) {
        this.updatePrivateValue(val);
      }
    }, 2000);

    const dispose1 = reaction(() => this.currentValue, debounced);
    const dispose2 = reaction(
      () => this.textBlock.content,
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
