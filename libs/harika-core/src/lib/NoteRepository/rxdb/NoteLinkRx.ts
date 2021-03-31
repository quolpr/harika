import { RxJsonSchema, RxCollection, RxDocument } from 'rxdb';
import { HarikaDatabaseCollections } from './collectionTypes';

export type NoteLinkRxDocType = {
  _id: string;
  noteBlock: string;
  note: string;
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
    noteBlock: {
      ref: HarikaDatabaseCollections.NOTE_BLOCKS,
      type: 'string',
    },
    note: {
      ref: HarikaDatabaseCollections.NOTES,
      type: 'string',
    },
    createdAt: {
      type: 'integer',
    },
    updatedAt: {
      type: 'integer',
    },
  },
  required: ['_id', 'note', 'noteBlock', 'createdAt'],
  indexes: ['_id', 'note', 'noteBlock', 'createdAt'],
};

type CollectionMethods = {
  getLinksByBlockIds(ids: string[]): Promise<NoteLinkRxDocument[]>;
};

const collectionMethods: CollectionMethods = {
  async getLinksByBlockIds(this: NoteLinkRxCollection, ids: string[]) {
    return this.find({ selector: { noteBlock: { $in: ids } } }).exec();
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
