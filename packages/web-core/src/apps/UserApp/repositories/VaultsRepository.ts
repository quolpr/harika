import { BaseSyncRepository } from '../../../lib/db/sync/persistence/BaseSyncRepository';

export const vaultsTable = 'vaults' as const;

export type VaultRow = {
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
};

export type VaultDoc = Omit<VaultRow, '_normalizedTitle'>;

export class SqlVaultsRepository extends BaseSyncRepository<
  VaultDoc,
  VaultRow
> {
  getTableName() {
    return vaultsTable;
  }
}
