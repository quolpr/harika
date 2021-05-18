interface BaseToken {
  offsetStart: number;
  offsetEnd: number;
}

export interface RefToken extends BaseToken {
  id: string;
  type: 'ref';
  content: string;
}

interface TagToken extends BaseToken {
  id: string;
  type: 'tag';
  content: string;
}

interface BoldToken extends BaseToken {
  id: string;
  type: 'bold';
  content: Token[];
}

interface ItalicToken extends BaseToken {
  id: string;
  type: 'italic';
  content: Token[];
}

interface HighlightToken extends BaseToken {
  id: string;
  type: 'highlight';
  content: Token[];
}

interface HeadToken extends BaseToken {
  id: string;
  type: 'head';
  depth: number;
  content: Token[];
}

interface InlineCodeToken extends BaseToken {
  id: string;
  type: 'inlineCode';
  content: string;
}

interface CodeBlockToken extends BaseToken {
  id: string;
  type: 'codeBlock';
  content: string;
}

interface StringToken extends BaseToken {
  id: string;
  type: 'str';
  content: string;
}

export type Token =
  | RefToken
  | TagToken
  | BoldToken
  | ItalicToken
  | HighlightToken
  | HeadToken
  | InlineCodeToken
  | CodeBlockToken
  | StringToken;
