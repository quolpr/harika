import type { Channel } from 'phoenix';
import { concatMap, map, merge, Observable, of, pipe, switchMap } from 'rxjs';
import {
  CommandTypesFromClient,
  GetChangesClientCommand,
  GetChangesResponse,
  IDatabaseChange,
} from '../../dexieTypes';
import type { CommandsExecuter } from '../CommandsExecuter';
import type { Table, Dexie } from 'dexie';
import type { ISyncStatus, SyncStatusService } from '../SyncStatusService';
import { v4 } from 'uuid';

export interface IChangePullRow {
  id: string;
  changeIds: string[];
  serverRevision: number;
}

export class ServerChangesReceiver {
  changeFromServerTable: Table<IDatabaseChange & { rev: number }>;
  changesPullsTable: Table<IChangePullRow>;

  constructor(
    private db: Dexie,
    private syncStatus: SyncStatusService,
    private commandExecuter: CommandsExecuter,
  ) {
    this.changeFromServerTable = this.db.table<
      IDatabaseChange & { rev: number }
    >('_changesFromServer');
    this.changesPullsTable = this.db.table<IChangePullRow>('_changesPulls');
  }

  emitter(channel$: Observable<Channel>, getChange$: Observable<unknown>) {
    return merge(
      of(null),
      channel$.pipe(
        switchMap((channel) => {
          return new Observable((observer) => {
            const ref = channel.on('revision_was_changed', () => {
              observer.next();
            });

            return () => channel.off('revision_was_changed', ref);
          });
        }),
      ),
      getChange$,
    );
  }

  pipe() {
    return pipe(
      switchMap(() => this.syncStatus.get()),
      switchMap((status) =>
        this.commandExecuter
          .send<GetChangesClientCommand>(CommandTypesFromClient.GetChanges, {
            fromRevision: status.lastReceivedRemoteRevision,
            includeSelf: false,
          })
          .pipe(map((res) => ({ res, syncStatus: status }))),
      ),
      concatMap(({ res, syncStatus }) => {
        if (res === null) {
          console.error('Failed to get changes');

          return of();
        }

        return this.storeReceivedChanges(res, syncStatus);
      }),
    );
  }

  private storeReceivedChanges = async (
    res: GetChangesResponse,
    syncStatus: ISyncStatus,
  ) => {
    await this.inTransaction(async () => {
      if (syncStatus.lastReceivedRemoteRevision === res.currentRevision) {
        if (res.changes.length > 0) {
          console.error('Revision is the same, but changes still received!');
        }
        return;
      }

      if (res.changes.length !== 0) {
        await this.changeFromServerTable.bulkAdd(res.changes);
      }

      await this.changesPullsTable.add({
        id: v4(),
        changeIds: res.changes.map(({ id }) => id),
        serverRevision: res.currentRevision,
      });

      await this.syncStatus.update({
        lastReceivedRemoteRevision: res.currentRevision,
      });
    });
  };

  private async inTransaction(handler: () => Promise<unknown>) {
    return this.db.transaction(
      'rw',
      [
        this.syncStatus.table,
        this.changeFromServerTable,
        this.changesPullsTable,
      ],
      handler,
    );
  }
}
