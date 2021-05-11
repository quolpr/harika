export interface RefToken {
  id: string;
  type: 'ref';
  content: string;
}

interface TagToken {
  id: string;
  type: 'tag';
  content: string;
}

interface BoldToken {
  id: string;
  type: 'bold';
  content: Token[];
}

interface ItalicToken {
  id: string;
  type: 'italic';
  content: Token[];
}

interface HighlightToken {
  id: string;
  type: 'highlight';
  content: Token[];
}

interface HeadToken {
  id: string;
  type: 'head';
  depth: number;
  content: Token[];
}

interface InlineCodeToken {
  id: string;
  type: 'inlineCode';
  content: string;
}

interface CodeBlockToken {
  id: string;
  type: 'codeBlock';
  content: string;
}

interface StringToken {
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

export default {
  parse(data: string): Token[];,
};
