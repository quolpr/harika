import { inject, injectable } from 'inversify';
import { map } from 'rxjs';

import { DbEventsListenService } from '../../../../extensions/SyncExtension/services/DbEventsListenerService';
import {
  VaultsRepository,
  vaultsTable,
} from '../repositories/VaultsRepository';

@injectable()
export class UserVaultsService {
  constructor(
    @inject(VaultsRepository)
    private vaultsRepo: VaultsRepository,
    @inject(DbEventsListenService)
    private dbEventsService: DbEventsListenService,
  ) {}

  async getVault(id: string) {
    return await this.vaultsRepo.getById(id);
  }

  getAllVaultTuples$() {
    return this.dbEventsService
      .liveQuery([vaultsTable], () => this.vaultsRepo.getAll())
      .pipe(
        map((vaults) =>
          vaults.map((v) => ({
            id: v.id,
            name: v.name,
            createAd: v.createdAt,
          })),
        ),
      );
  }

  async createVault({ name, dbId }: { name: string; dbId: string }) {
    return await this.vaultsRepo.create(
      {
        id: dbId,
        name,
        updatedAt: new Date().getTime(),
        createdAt: new Date().getTime(),
      },
      {
        shouldRecordChange: true,
        source: 'inDbChanges',
      },
    );
  }

  // TODO: also clean on server
  // TODO: drop local DB
  async dropVault(vaultId: string) {
    await this.vaultsRepo.delete(vaultId, {
      shouldRecordChange: true,
      source: 'inDbChanges',
    });
  }

  async renameVault(dbId: string, name: string) {
    const vaultDoc = await this.vaultsRepo.getById(dbId);

    if (!vaultDoc) throw new Error('Nothing to rename');

    await this.vaultsRepo.update(
      {
        ...vaultDoc,
        name,
        updatedAt: new Date().getTime(),
      },
      {
        shouldRecordChange: true,
        source: 'inDbChanges',
      },
    );

    return true;
  }
}
