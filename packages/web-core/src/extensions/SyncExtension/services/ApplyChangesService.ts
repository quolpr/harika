import { inject, injectable, multiInject } from 'inversify';
import { groupBy } from 'lodash-es';
import { REPOS_WITH_SYNC } from '../types';
import type { BaseSyncRepository } from '../BaseSyncRepository';
import { SyncRepository } from '../repositories/SyncRepository';

@injectable()
export class ApplyChangesService {
  constructor(
    @multiInject(REPOS_WITH_SYNC) private reposWithSync: BaseSyncRepository[],
    @inject(SyncRepository) private syncRepo: SyncRepository,
  ) {}

  applyChanges() {
    const reposByTable: Record<string, BaseSyncRepository> = {};

    this.reposWithSync.forEach((r) => {
      reposByTable[r.getTableName()] = r;
    });

    return this.syncRepo.transaction(async (t) => {
      const serverPulls = await this.syncRepo.getChangesPulls(t);

      if (serverPulls.length === 0) return;

      const serverChanges = await this.syncRepo.getServerChangesByPullIds(
        serverPulls.map(({ id }) => id),
        t,
      );

      if (serverChanges.length > 0) {
        const groupedServerChange = groupBy(serverChanges, (ch) => ch.table);

        for (const [tableName, chs] of Object.entries(groupedServerChange)) {
          const repo = reposByTable[tableName];

          if (!repo) {
            throw new Error(`Could find repo for ${JSON.stringify(chs)}`);
          }

          // TODO: write change
          // TODO: recalculate snapshot
        }
      }

      await this.syncRepo.deletePulls(
        serverPulls.map(({ id }) => id),
        t,
      );
    });
  }
}
