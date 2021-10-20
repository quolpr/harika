import { BaseSyncRepository } from '../../../../../extensions/SyncExtension/worker/BaseSyncRepository';
import { UserDbChangesApplier } from '../sync/UserDbChangesApplier';

export const vaultsTable = 'vaults' as const;

export type VaultRow = {
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
};

export type VaultDoc = Omit<VaultRow, '_normalizedTitle'>;

export class VaultsRepository extends BaseSyncRepository<VaultDoc, VaultRow> {
  getTableName() {
    return vaultsTable;
  }

  changesApplier() {
    return new UserDbChangesApplier();
  }
}
