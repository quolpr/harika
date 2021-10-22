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
import { IQueryExecuter } from '../../../DbExtension/DB';

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

    return this.syncRepo.transaction(async (t) => {
      const syncStatus = await this.syncRepo.getSyncStatus(t);
      const serverPulls = await this.syncRepo.getChangesPulls(t);

      if (serverPulls.length === 0) return;

      const serverChanges = await this.syncRepo.getServerChangesByPullIds(
        serverPulls.map(({ id }) => id),
        t,
      );

      if (serverChanges.length > 0) {
        const clientChanges = await this.syncRepo.getClientChanges(t);

        const groupedClientChange = groupBy(clientChanges, (ch) => ch.table);
        const groupedServerChange = groupBy(serverChanges, (ch) => ch.table);

        for (const [tableName, chs] of Object.entries(groupedServerChange)) {
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
            t,
          );

          this.dbChangesWriter.writeChanges(
            result.conflictedChanges,
            repo,
            {
              shouldRecordChange: true,
              source: 'inDbChanges' as const,
            },
            t,
          );
        }
      }

      await this.syncRepo.deletePulls(
        serverPulls.map(({ id }) => id),
        t,
      );

      const maxRevision = maxBy(
        serverPulls,
        ({ serverRevision }) => serverRevision,
      )?.serverRevision;

      if (maxRevision) {
        await this.syncRepo.updateSyncStatus(
          {
            lastAppliedRemoteRevision: maxRevision,
          },
          t,
        );
      }
    });
  }
}

export class DbChangesWriterService {
  async writeChanges(
    changes: IDatabaseChange[],
    repo: BaseSyncRepository,
    ctx: ISyncCtx,
    e: IQueryExecuter,
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

    return repo.transaction(async (t) => {
      if (createChangesToApply.length > 0)
        await repo.bulkCreateOrUpdate(
          createChangesToApply.map((c) => c.obj),
          ctx,
          t,
        );

      if (updateChangesToApply.length > 0)
        await this.bulkUpdate(updateChangesToApply, repo, ctx, t);

      if (deleteChangesToApply.length > 0)
        await repo.bulkDelete(
          deleteChangesToApply.map((c) => c.key),
          ctx,
          t,
        );
    });
  }

  private async bulkUpdate(
    changes: IUpdateChange[],
    repo: BaseSyncRepository,
    ctx: ISyncCtx,
    e: IQueryExecuter,
  ) {
    let keys = changes.map((c) => c.key);
    let map: Record<string, any> = {};

    // Retrieve current object of each change to update and map each
    // found object's primary key to the existing object:
    (await repo.getByIds(keys, e)).forEach((obj) => {
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

    return repo.bulkUpdate(objsToPut, ctx, e);
  }
}
