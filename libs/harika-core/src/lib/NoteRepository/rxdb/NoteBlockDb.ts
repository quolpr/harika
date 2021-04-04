import { RxJsonSchema, RxCollection, RxDocument } from 'rxdb';
import { HarikaDatabaseCollections } from './collectionTypes';
import { NoteDocument } from './NoteRx';

export type NoteBlockDocType = {
  _id: string;
  parentBlockRef?: string;
  noteRef: string;
  noteBlockRefs: string[];
  linkedNoteRefs: string[];
  content: string;
  createdAt: number;
  updatedAt?: number;
};

export const schema: RxJsonSchema<NoteBlockDocType> = {
  version: 0,
  type: 'object',
  properties: {
    _id: {
      type: 'string',
      primary: true,
    },
    parentBlockRef: {
      ref: HarikaDatabaseCollections.NOTE_BLOCKS,
      type: 'string',
    },
    noteRef: {
      ref: HarikaDatabaseCollections.NOTES,
      type: 'string',
    },
    noteBlockRefs: {
      type: 'array',
      ref: HarikaDatabaseCollections.NOTE_BLOCKS,
      items: {
        type: 'string',
      },
    },
    linkedNoteRefs: {
      type: 'array',
      ref: HarikaDatabaseCollections.NOTES,
      items: {
        type: 'string',
      },
    },
    content: {
      type: 'string',
    },
    createdAt: {
      type: 'integer',
    },
    updatedAt: {
      type: 'integer',
    },
  },
  required: ['noteRef', 'content', 'noteBlockRefs', 'linkedNoteRefs'],
  indexes: ['_id', 'noteRef', 'content', 'parentBlockRef', 'linkedNoteRefs.[]'],
};

type CollectionMethods = {
  getById(id: string): Promise<NoteBlockDocument | null>;
  getByIds(ids: string[]): Promise<NoteBlockDocument[]>;
};

const collectionMethods: CollectionMethods = {
  getById(this: NoteBlockCollection, id: string) {
    return this.findOne({
      selector: { _id: id },
    }).exec();
  },
  async getByIds(this: NoteBlockCollection, ids: string[]) {
    return Array.from((await this.database.noteblocks.findByIds(ids)).values());
  },
};

type DocumentMethods = {
  getNote(): Promise<NoteDocument>;
};

const documentMethods = {
  getNote(this: NoteBlockDocument) {
    return this.collection.database.notes
      .findOne({
        selector: { _id: this.noteRef },
      })
      .exec();
  },
};

export type NoteBlockCollection = RxCollection<
  NoteBlockDocType,
  DocumentMethods,
  CollectionMethods
>;
export type NoteBlockDocument = RxDocument<NoteBlockDocType, DocumentMethods>;

export const dbNoteBlocksCollection = {
  schema,
  methods: documentMethods,
  statics: collectionMethods,
};
