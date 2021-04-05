import { RxJsonSchema, RxCollection, RxDocument } from 'rxdb';
import { VaultDatabaseCollections } from './collectionTypes';
import { NoteDocument } from './NoteDoc';

export type NoteBlockDocType = {
  _id: string;
  parentBlockId?: string;
  noteId: string;
  noteBlockIds: string[];
  linkedNoteIds: string[];
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
    parentBlockId: {
      ref: VaultDatabaseCollections.NOTE_BLOCKS,
      type: 'string',
    },
    noteId: {
      ref: VaultDatabaseCollections.NOTES,
      type: 'string',
    },
    noteBlockIds: {
      type: 'array',
      ref: VaultDatabaseCollections.NOTE_BLOCKS,
      items: {
        type: 'string',
      },
    },
    linkedNoteIds: {
      type: 'array',
      ref: VaultDatabaseCollections.NOTES,
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
  required: ['noteId', 'content', 'noteBlockIds', 'linkedNoteIds'],
  indexes: ['_id', 'noteId', 'content', 'parentBlockId', 'linkedNoteIds.[]'],
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
        selector: { _id: this.noteId },
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
