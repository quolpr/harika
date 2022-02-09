import { inject, injectable, multiInject } from 'inversify';
import { groupBy } from 'lodash-es';
import { concatMap, Observable, takeUntil } from 'rxjs';

import { STOP_SIGNAL } from '../../../framework/types';
import { Transaction } from '../../DbExtension/DB';
import { BaseSyncRepository } from '../BaseSyncRepository';
import { SyncRepository } from '../repositories/SyncRepository';
import { ISyncCtx } from '../syncCtx';
import { REPOS_WITH_SYNC } from '../types';

@injectable()
export class SnapshotsApplier {
  constructor(
    @inject(SyncRepository)
    private syncRepo: SyncRepository,
    @inject(STOP_SIGNAL) private stop$: Observable<void>,
    @multiInject(REPOS_WITH_SYNC) private reposWithSync: BaseSyncRepository[],
  ) {}

  start() {
    new Observable((obs) => {
      return this.syncRepo.onNewSnapshots(() => {
        obs.next();
      });
    })
      .pipe(
        concatMap(() => this.syncRepo.transaction(this.applySnapshots)),
        takeUntil(this.stop$),
      )

      .subscribe();
  }

  private applySnapshots = async (t: Transaction) => {
    const snapshots = await this.syncRepo.getServerSnapshots(t);

    const syncCtx: ISyncCtx = {
      shouldRecordChange: false,
      source: 'inDbChanges',
    };

    const repoByCollection = Object.fromEntries(
      this.reposWithSync.map((r) => [r.getTableName(), r]),
    );

    for (const [collectionName, groupedSnapshots] of Object.entries(
      groupBy(snapshots, (sn) => sn.collectionName),
    )) {
      const reg = repoByCollection[collectionName];

      if (!reg) {
        console.error(
          'Registration not found for',
          collectionName,
          groupedSnapshots,
        );

        continue;
      }

      const deletedIds = groupedSnapshots
        .filter((sn) => sn.isDeleted)
        .map((sn) => sn.docId);

      if (deletedIds.length > 0) {
        await reg.bulkDelete(deletedIds, syncCtx, t);
      }

      await reg.bulkCreateOrUpdate(
        groupedSnapshots
          .filter((sn) => sn.isDeleted === false)
          .map((sn) => sn.doc),
        syncCtx,
        t,
      );

      await this.syncRepo.deleteSnapshots(
        t,
        snapshots.map((sn) => sn.id),
      );
    }
  };
}
