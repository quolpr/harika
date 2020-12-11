import { RxJsonSchema, RxCollection, RxDocument } from 'rxdb';
import { HarikaDatabase } from '../initDb';
import { HarikaDatabaseDocuments } from '../HarikaDatabaseDocuments';

type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export type NoteBlockDocType = {
  _id: string;
  parentBlockId: string | null;
  noteId: string;
  content: string;
  order: number;
};

export const schema: RxJsonSchema<NoteBlockDocType> = {
  title: 'hero schema',
  description: 'describes a note',
  version: 0,
  type: 'object',
  properties: {
    _id: {
      type: 'string',
      primary: true,
    },
    parentBlockId: {
      ref: HarikaDatabaseDocuments.NOTE_BLOCKS,
      type: ['string', 'null'],
    },
    noteId: {
      ref: HarikaDatabaseDocuments.NOTES,
      type: 'string',
    },
    content: {
      type: 'string',
    },
    order: {
      type: 'integer',
    },
  },
  required: ['noteId', 'content', 'order'],
};

type DocMethods = {
  updateContent(content: string): Promise<void>;
  injectNewRightBlock(newContent: string): Promise<NoteBlockDocument>;
  mergeToLeftAndDelete(): Promise<NoteBlockDocument>;
  tryMoveUp(): Promise<void>;
  tryMoveDown(): Promise<void>;
  getLeftAndRight(): Promise<
    [left: NoteBlockDocument | undefined, right: NoteBlockDocument | undefined]
  >;
};

export const docMethods: DocMethods = {
  async updateContent(this: NoteBlockDocument, content) {
    console.log('patch');
    this.atomicPatch({
      content,
    });
  },
  async injectNewRightBlock(this: NoteBlockDocument, newContent) {},
  async mergeToLeftAndDelete(this: NoteBlockDocument) {},
  async tryMoveUp(this: NoteBlockDocument) {},
  async tryMoveDown(this: NoteBlockDocument) {},
  async getLeftAndRight(this: NoteBlockDocument) {},
};

export type NoteBlockCollection = RxCollection<NoteBlockDocType, DocMethods>;
export type NoteBlockDocument = RxDocument<NoteBlockDocType, DocMethods>;

export const createBlockNote = (
  database: HarikaDatabase,
  fields: Optional<NoteBlockDocType, '_id'>
) => {
  return database.noteblocks.insert(fields);
};

export const dbNoteBlocksCollection = {
  schema,
  methods: docMethods,
};
