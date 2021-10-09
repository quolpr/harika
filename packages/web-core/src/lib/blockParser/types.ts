import type { LinkEntityType } from 'linkifyjs';

interface BaseToken {
  offsetStart: number;
  offsetEnd: number;
}

export interface NoteRefToken extends BaseToken {
  id: string;
  type: 'noteRef';
  content: string;
  ref: string;
  alias: string | undefined;
}

export interface TodoRefToken extends NoteRefToken {
  id: string;
  type: 'noteRef';
  ref: 'TODO' | 'DONE';
}

export interface NoteBlockRef extends BaseToken {
  id: string;
  type: 'noteBlockRef';
  content: string;
  blockId: string | undefined;
}

export interface TagToken extends BaseToken {
  id: string;
  type: 'tag';
  ref: string;
  content: string;
  withBrackets: boolean;
}

interface BoldToken extends BaseToken {
  id: string;
  type: 'bold';
  content: Token[];
}

interface QuoteToken extends BaseToken {
  id: string;
  type: 'quote';
  content: Token[];
  withTrailingEOL: boolean;
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
  withTrailingEOL: boolean;
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
  withTrailingEOL: boolean;
}

interface StringToken extends BaseToken {
  id: string;
  type: 'str';
  content: string;
}

interface LinkToken extends BaseToken {
  id: string;
  type: 'link';
  content: string;
  href: string;
  linkType: LinkEntityType;
}

export type Token =
  | NoteRefToken
  | NoteBlockRef
  | TagToken
  | BoldToken
  | ItalicToken
  | HighlightToken
  | HeadToken
  | InlineCodeToken
  | CodeBlockToken
  | StringToken
  | LinkToken
  | QuoteToken;