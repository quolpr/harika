interface BaseToken {
  offsetStart: number;
  offsetEnd: number;
}

export interface NoteBlockRefToken extends BaseToken {
  id: string;
  type: 'noteBlockRef';
  content: string;
  ref: string;
  alias: string | undefined;
}

export interface TodoRefToken extends NoteBlockRefToken {
  id: string;
  type: 'noteBlockRef';
  ref: 'TODO' | 'DONE';
}

export interface TextBlockRef extends BaseToken {
  id: string;
  type: 'textBlockRef';
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

export interface StringToken extends BaseToken {
  id: string;
  type: 'str';
  content: string;
}

interface LinkToken extends BaseToken {
  id: string;
  type: 'link';
  content: string;
  href: string;
  linkType: string;
}

export interface ImageToken extends BaseToken {
  id: string;
  type: 'image';
  url: string;
  title: string;
  width?: number;
  height?: number;
}

export interface TemplateToken extends BaseToken {
  id: string;
  type: 'template';
  templateType: string;
  content: any;
}

export interface AttachmentTemplateToken extends BaseToken {
  id: string;
  type: 'template';
  templateType: 'attachment';
  content: {
    url: string;
    name: string;
  };
}

export interface EmbedVideoTemplateToken extends BaseToken {
  id: string;
  type: 'template';
  templateType: 'embed-video';
  content: {
    url: string;
    provider: string;
  };
}

export type Token =
  | NoteBlockRefToken
  | TextBlockRef
  | TagToken
  | BoldToken
  | ItalicToken
  | HighlightToken
  | HeadToken
  | InlineCodeToken
  | CodeBlockToken
  | StringToken
  | LinkToken
  | QuoteToken
  | ImageToken
  | EmbedVideoTemplateToken
  | AttachmentTemplateToken;
