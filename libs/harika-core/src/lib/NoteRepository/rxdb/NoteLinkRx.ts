import { RxJsonSchema, RxCollection, RxDocument } from 'rxdb';
import { HarikaDatabaseCollections } from './collectionTypes';

export type NoteLinkDocType = {
  _id: string;
  noteBlock: string;
  note: string;
  createdAt: number;
  updatedAt?: number;
};

export const schema: RxJsonSchema<NoteLinkDocType> = {
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
  getLinksByBlockIds(ids: string[]): Promise<NoteLinkDocument[]>;
};

const collectionMethods: CollectionMethods = {
  async getLinksByBlockIds(this: NoteLinkCollection, ids: string[]) {
    return this.find({ selector: { noteBlock: { $in: ids } } }).exec();
  },
};

export type NoteLinkCollection = RxCollection<
  NoteLinkDocType,
  // eslint-disable-next-line @typescript-eslint/ban-types
  {},
  CollectionMethods
>;
export type NoteLinkDocument = RxDocument<NoteLinkDocType>;

export const dbNoteLinkCollection = {
  schema,
  statics: collectionMethods,
};
