import { RxJsonSchema, RxCollection, RxDocument } from 'rxdb';

export type VaultDocType = {
  _id: string;
  name: string;
  createdAt: number;
  updatedAt?: number;
};

export const schema: RxJsonSchema<VaultDocType> = {
  description: 'describes a note link',
  version: 0,
  type: 'object',
  properties: {
    _id: {
      type: 'string',
      primary: true,
    },
    name: {
      type: 'string',
    },
    createdAt: {
      type: 'integer',
    },
    updatedAt: {
      type: 'integer',
    },
  },
  required: ['_id', 'name', 'createdAt'],
  indexes: ['_id'],
};

// eslint-disable-next-line @typescript-eslint/ban-types
type CollectionMethods = {};

const collectionMethods: CollectionMethods = {};

export type VaultCollection = RxCollection<
  VaultDocType,
  // eslint-disable-next-line @typescript-eslint/ban-types
  {},
  CollectionMethods
>;
export type VaultDocument = RxDocument<VaultDocType>;

export const vaultCollection = {
  schema,
  statics: collectionMethods,
};
