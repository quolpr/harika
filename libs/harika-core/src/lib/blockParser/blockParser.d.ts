interface RefToken {
  type: 'ref';
  content: string;
}

interface TagToken {
  type: 'tag';
  content: string;
}

interface BoldToken {
  type: 'bold';
  content: Token[];
}

interface ItalicToken {
  type: 'italic';
  content: Token[];
}

interface HighlightToken {
  type: 'highlight';
  content: Token[];
}

interface HeadToken {
  type: 'head';
  depth: number;
  content: Token[];
}

interface InlineCodeToken {
  type: 'inlineCode';
  content: string;
}

interface CodeBlockToken {
  type: 'codeBlock';
  content: string;
}

interface StringToken {
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
