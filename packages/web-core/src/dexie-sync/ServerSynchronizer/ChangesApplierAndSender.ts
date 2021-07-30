import {
  ApplyNewChangesFromClientCommand,
  CommandTypesFromClient,
  DatabaseChangeType,
  IDatabaseChange,
} from '../../dexieTypes';
import type { CommandsExecuter } from '../CommandsExecuter';
import type { SyncStatusService } from '../SyncStatusService';
import { Dexie, liveQuery, Table } from 'dexie';
import type { IChangePullRow } from './ServerChangesReceiver';
import {
  filter,
  from,
  map,
  merge,
  Observable,
  of,
  pipe,
  Subject,
  switchMap,
} from 'rxjs';
import type { IConflictsResolver } from '../ServerSynchronizer';
import { maxBy, omit } from 'lodash-es';

type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

type IChangeRow = DistributiveOmit<IDatabaseChange, 'source'>;
type IChangeRowWithRev = IChangeRow & {
  rev: number;
};

export class ChangesApplierAndSender {
  changeFromServerTable: Table<IDatabaseChange & { rev: number }>;
  changesPullsTable: Table<IChangePullRow>;
  changesToSendTable: Table<IChangeRowWithRev>;

  constructor(
    private db: Dexie,
    private syncStatus: SyncStatusService,
    private commandExecuter: CommandsExecuter,
    private conflictResolver: IConflictsResolver,
    private triggerGetChangesSubject: Subject<unknown>,
    private log: (str: string) => void,
  ) {
    this.changeFromServerTable = this.db.table<
      IDatabaseChange & { rev: number }
    >('_changesFromServer');
    this.changesPullsTable = this.db.table<IChangePullRow>('_changesPulls');
    this.changesToSendTable =
      this.db.table<IChangeRowWithRev>('_changesToSend');
  }

  emitter() {
    return merge(
      from(
        liveQuery(() =>
          this.changesPullsTable.limit(1).toArray(),
        ) as Observable<unknown[]>,
      ).pipe(filter((c) => c.length > 0)),
      from(
        liveQuery(() =>
          this.changesToSendTable.limit(1).toArray(),
        ) as Observable<unknown[]>,
      ).pipe(filter((c) => c.length > 0)),
    );
  }

  pipe() {
    return pipe(
      switchMap(() => this.applyServerChanges()),
      switchMap(() => this.sendChanges()),
    );
  }

  private async applyServerChanges() {
    await this.db.transaction('rw', this.db.tables, async () => {
      const syncStatus = await this.syncStatus.get();

      const serverPulls = await this.changesPullsTable.toArray();
      const changeIds = serverPulls.flatMap((pull) => pull.changeIds);
      const serverChanges = await this.changeFromServerTable
        .where('id')
        .anyOf(changeIds)
        .sortBy('rev');

      if (serverChanges.length > 0) {
        const clientChanges = await this.changesToSendTable
          .orderBy('rev')
          .toArray();

        await this.conflictResolver.resolveChanges(
          clientChanges.map((change) => ({
            ...change,
            source: syncStatus.clientId,
          })),
          serverChanges,
        );

        await this.changeFromServerTable.bulkDelete(
          serverChanges.map(({ id }) => id),
        );
      }

      const maxRevision = maxBy(
        serverPulls,
        ({ serverRevision }) => serverRevision,
      )?.serverRevision;

      if (maxRevision) {
        await this.syncStatus.update({
          lastAppliedRemoteRevision: maxRevision,
        });
      }
    });
  }

  private sendChanges = () => {
    return from(this.changesToSendTable.orderBy('rev').toArray()).pipe(
      filter((clientChanges) => clientChanges.length > 0),
      switchMap(async (clientChanges) => ({
        clientChanges,
        syncStatus: await this.syncStatus.get(),
      })),
      switchMap(({ clientChanges, syncStatus }) =>
        this.commandExecuter
          .send<ApplyNewChangesFromClientCommand>(
            CommandTypesFromClient.ApplyNewChanges,
            {
              changes: clientChanges.map((change) => ({
                ...(change.type === DatabaseChangeType.Update
                  ? omit(change, 'obj')
                  : change),
                source: syncStatus.clientId,
              })),
              partial: false,
              lastAppliedRemoteRevision: syncStatus.lastAppliedRemoteRevision,
            },
          )
          .pipe(map((res) => ({ res, clientChanges }))),
      ),
      switchMap(({ res, clientChanges }) => {
        if (!res) return of(null);

        if (res.status === 'locked') {
          this.log('Locked. Just waiting for new changes');

          return of(null);
        }

        if (res.status === 'stale_changes') {
          // Maybe server has newer changes. Let's await for new server changes and try to send again
          this.triggerGetChangesSubject.next(null);

          return of(null);
        }

        return this.changesToSendTable.bulkDelete(
          clientChanges.map(({ rev }) => rev),
        );
      }),
    );
  };
}
