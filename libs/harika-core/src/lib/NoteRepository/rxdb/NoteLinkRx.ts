import { RxJsonSchema, RxCollection, RxDocument } from 'rxdb';
import { HarikaDatabaseDocuments } from './collectionTypes';

export type NoteLinkRxDocType = {
  _id: string;
  noteBlockId: string;
  noteId: string;
  createdAt: number;
  updatedAt?: number;
};

export const schema: RxJsonSchema<NoteLinkRxDocType> = {
  description: 'describes a note link',
  version: 0,
  type: 'object',
  properties: {
    _id: {
      type: 'string',
      primary: true,
    },
    noteBlockId: {
      ref: HarikaDatabaseDocuments.NOTE_BLOCKS,
      type: 'string',
    },
    noteId: {
      ref: HarikaDatabaseDocuments.NOTES,
      type: 'string',
    },
    createdAt: {
      type: 'integer',
    },
    updatedAt: {
      type: 'integer',
    },
  },
  required: ['_id', 'noteId', 'noteBlockId', 'createdAt'],
  indexes: ['_id', 'noteId', 'noteBlockId', 'createdAt'],
};

type CollectionMethods = {
  getLinksByBlockIds(ids: string[]): Promise<NoteLinkRxDocument[]>;
};

const collectionMethods: CollectionMethods = {
  async getLinksByBlockIds(this: NoteLinkRxCollection, ids: string[]) {
    return this.find({ selector: { noteBlockId: { $in: ids } } }).exec();
  },
};

export type NoteLinkRxCollection = RxCollection<
  NoteLinkRxDocType,
  {},
  CollectionMethods
>;
export type NoteLinkRxDocument = RxDocument<NoteLinkRxDocType>;

export const dbNoteLinkRxCollection = {
  schema,
  statics: collectionMethods,
};
