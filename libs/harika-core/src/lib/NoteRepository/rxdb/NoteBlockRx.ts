import { RxJsonSchema, RxCollection, RxDocument } from 'rxdb';
import { HarikaDatabaseDocuments } from './collectionTypes';
import { NoteDocument } from './NoteRx';

export type NoteBlockDocType = {
  _id: string;
  parentBlock?: string;
  note: string;
  noteBlocks: string[];
  content: string;
  createdAt: number;
  updatedAt?: number;
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
    parentBlock: {
      ref: HarikaDatabaseDocuments.NOTE_BLOCKS,
      type: 'string',
    },
    note: {
      ref: HarikaDatabaseDocuments.NOTES,
      type: 'string',
    },
    noteBlocks: {
      type: 'array',
      ref: HarikaDatabaseDocuments.NOTE_BLOCKS,
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
  required: ['note', 'content', 'noteBlocks'],
  indexes: ['_id', 'note', 'content', 'parentBlock'],
};

type CollectionMethods = {
  getById(id: string): Promise<NoteBlockDocument | null>;
};

const collectionMethods: CollectionMethods = {
  getById(this: NoteBlockCollection, id: string) {
    return this.findOne({
      selector: { _id: id },
    }).exec();
  },
};

type DocumentMethods = {
  getNote(): Promise<NoteDocument>;
};

const documentMethods = {
  getNote(this: NoteBlockDocument) {
    return this.collection.database.notes
      .findOne({
        selector: { _id: this.note },
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
