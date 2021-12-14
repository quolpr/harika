import { inject, injectable } from 'inversify';
import { groupBy } from 'lodash-es';
import { concatMap, Observable, takeUntil } from 'rxjs';
import { STOP_SIGNAL } from '../../../framework/types';
import { Transaction } from '../../DbExtension/DB';
import { SyncRepository } from '../repositories/SyncRepository';
import { SyncConfig } from '../serverSynchronizer/SyncConfig';
import { ISyncCtx } from '../syncCtx';

@injectable()
export class SnapshotsApplier {
  constructor(
    @inject(SyncConfig)
    private syncConfig: SyncConfig,
    @inject(SyncRepository)
    private syncRepo: SyncRepository,
    @inject(STOP_SIGNAL) private stop$: Observable<void>,
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

    for (const [collectionName, groupedSnapshots] of Object.entries(
      groupBy(snapshots, (sn) => sn.collectionName),
    )) {
      const reg =
        this.syncConfig.getRegistrationByCollectionName(collectionName);
      if (!reg) {
        console.error('Registration not found for', collectionName);

        continue;
      }

      const deletedIds = groupedSnapshots
        .filter((sn) => sn.isDeleted)
        .map((sn) => sn.docId);

      if (deletedIds.length > 0) {
        await reg.repo.bulkDelete(deletedIds, syncCtx, t);
      }

      await reg.repo.bulkCreateOrUpdate(
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
