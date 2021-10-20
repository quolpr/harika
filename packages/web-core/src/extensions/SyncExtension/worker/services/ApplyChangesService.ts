import { inject, injectable, multiInject } from 'inversify';
import { groupBy, maxBy } from 'lodash-es';
import type {
  IDatabaseChange,
  ICreateChange,
  IDeleteChange,
  IUpdateChange,
} from '../../app/serverSynchronizer/types';
import { DatabaseChangeType } from '../../app/serverSynchronizer/types';
import { REPOS_WITH_SYNC } from '../../types';
import type { BaseSyncRepository } from '../BaseSyncRepository';
import type { ISyncCtx } from '../syncCtx';
import { SyncRepository } from '../repositories/SyncRepository';
import { remotable } from '../../../../framework/utils';

@remotable('ApplyChangesService')
@injectable()
export class ApplyChangesService {
  private dbChangesWriter = new DbChangesWriterService();

  constructor(
    @multiInject(REPOS_WITH_SYNC) private reposWithSync: BaseSyncRepository[],
    @inject(SyncRepository) private syncRepo: SyncRepository,
  ) {}

  applyChanges() {
    const reposByTable: Record<string, BaseSyncRepository> = {};

    this.reposWithSync.forEach((r) => {
      reposByTable[r.getTableName()] = r;
    });

    this.syncRepo.transaction(() => {
      const syncStatus = this.syncRepo.getSyncStatus();

      const serverPulls = this.syncRepo.getChangesPulls();

      if (serverPulls.length === 0) return;

      const serverChanges = this.syncRepo.getServerChangesByPullIds(
        serverPulls.map(({ id }) => id),
      );

      if (serverChanges.length > 0) {
        const clientChanges = this.syncRepo.getClientChanges();
        const groupedClientChange = groupBy(clientChanges, (ch) => ch.table);
        const groupedServerChange = groupBy(serverChanges, (ch) => ch.table);

        Object.entries(groupedServerChange).forEach(([tableName, chs]) => {
          const repo = reposByTable[tableName];

          if (!repo) {
            throw new Error(`Could find repo for ${JSON.stringify(chs)}`);
          }

          const result = repo.changesApplier().resolveChanges(
            groupedClientChange[tableName] || [],
            chs.map((change) => ({
              ...change,
              source: syncStatus.clientId,
            })),
          );

          this.dbChangesWriter.writeChanges(
            result.notConflictedServerChanges,
            repo,
            {
              shouldRecordChange: false,
              source: 'inDbChanges' as const,
            },
          );

          this.dbChangesWriter.writeChanges(result.conflictedChanges, repo, {
            shouldRecordChange: true,
            source: 'inDbChanges' as const,
          });
        });
      }

      this.syncRepo.deletePulls(serverPulls.map(({ id }) => id));

      const maxRevision = maxBy(
        serverPulls,
        ({ serverRevision }) => serverRevision,
      )?.serverRevision;

      if (maxRevision) {
        this.syncRepo.updateSyncStatus({
          lastAppliedRemoteRevision: maxRevision,
        });
      }
    });
  }
}

export class DbChangesWriterService {
  writeChanges(
    changes: IDatabaseChange[],
    repo: BaseSyncRepository,
    ctx: ISyncCtx,
  ) {
    if (changes.length === 0) return;

    const collectedChanges: {
      [DatabaseChangeType.Create]: ICreateChange[];
      [DatabaseChangeType.Delete]: IDeleteChange[];
      [DatabaseChangeType.Update]: IUpdateChange[];
    } = {
      [DatabaseChangeType.Create]: [],
      [DatabaseChangeType.Delete]: [],
      [DatabaseChangeType.Update]: [],
    };

    changes.forEach((ch) => {
      if (ch.table !== repo.getTableName())
        throw new Error(
          `Only table type ${repo.getTableName()} could be used. Received: ${
            ch.table
          }`,
        );

      collectedChanges[ch.type].push(ch as any);
    });

    const createChangesToApply = collectedChanges[DatabaseChangeType.Create];
    const deleteChangesToApply = collectedChanges[DatabaseChangeType.Delete];
    const updateChangesToApply = collectedChanges[DatabaseChangeType.Update];

    repo.transaction(() => {
      if (createChangesToApply.length > 0)
        repo.bulkCreateOrUpdate(
          createChangesToApply.map((c) => c.obj),
          ctx,
        );

      if (updateChangesToApply.length > 0)
        this.bulkUpdate(updateChangesToApply, repo, ctx);

      if (deleteChangesToApply.length > 0)
        repo.bulkDelete(
          deleteChangesToApply.map((c) => c.key),
          ctx,
        );
    });
  }

  private bulkUpdate(
    changes: IUpdateChange[],
    repo: BaseSyncRepository,
    ctx: ISyncCtx,
  ) {
    let keys = changes.map((c) => c.key);
    let map: Record<string, any> = {};

    // Retrieve current object of each change to update and map each
    // found object's primary key to the existing object:
    repo.getByIds(keys).forEach((obj) => {
      map[obj.id] = obj;
    });

    // Filter away changes whose key wasn't found in the local database
    // (we can't update them if we do not know the existing values)
    let updatesThatApply = changes.filter((ch) => map.hasOwnProperty(ch.key));

    // Apply modifications onto each existing object (in memory)
    // and generate array of resulting objects to put using bulkPut():
    let objsToPut = updatesThatApply.map((ch) => {
      let row = map[ch.key];

      // TODO: also mark keys from `from` that not present in `to` as undefined
      Object.keys(ch.to).forEach((keyPath) => {
        row[keyPath] = ch.to[keyPath];
      });

      return row;
    });

    return repo.bulkUpdate(objsToPut, ctx);
  }
}
