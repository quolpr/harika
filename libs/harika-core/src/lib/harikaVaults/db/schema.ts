import { appSchema, tableSchema } from '@nozbe/watermelondb';

export enum VaultsTableNames {
  VAULTS = 'vaults',
}

export const vaultsSchema = appSchema({
  version: 39,
  tables: [
    tableSchema({
      name: VaultsTableNames.VAULTS,
      columns: [
        { name: 'name', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
