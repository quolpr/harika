import { Dexie, liveQuery } from 'dexie';
import io from 'socket.io-client';
import { v4 } from 'uuid';
import {
  BehaviorSubject,
  combineLatest,
  fromEvent,
  merge,
  Subject,
  Observable,
  of,
} from 'rxjs';
import {
  concatMap,
  map,
  mapTo,
  mergeMap,
  shareReplay,
  switchMap,
  takeUntil,
} from 'rxjs/operators';
import { BroadcastChannel, createLeaderElection } from 'broadcast-channel';
import {
  EventTypesFromServer,
  CommandTypesFromClient,
  IDatabaseChange,
  RevisionWasChangedEvent,
  GetChangesClientCommand,
} from '@harika/common';
import type { CommandsExecuter } from './CommandsExecuter';
import { applyChanges } from './applyChanges';
import { SyncStatusService } from './SyncStatusService';
import { ServerConnector } from './ServerConnector';

type IChangeRow = DistributiveOmit<IDatabaseChange, 'source'>;
type IChangeRowWithRev = IChangeRow & {
  rev: string;
};

export interface IServerChangesRow {
  id: string;
  change: IDatabaseChange;
  receivedAtRevisionOfServer: number;
}

type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

export class ServerSynchronizer {
  private stop$: Subject<void> = new Subject();
  private triggerGetChangesSubject = new Subject<unknown>();
  private syncStatus: SyncStatusService;
  private commandExecuter: CommandsExecuter;
  private serverConnector: ServerConnector;

  constructor(
    private db: Dexie,
    private gatewayName: string,
    private scopeId: string,
    url: string,
  ) {
    this.syncStatus = new SyncStatusService(db);

    this.serverConnector = new ServerConnector(
      db,
      scopeId,
      url,
      this.stop$,
      this.syncStatus,
      this.log,
    );

    this.commandExecuter = this.serverConnector.commandExecuter;
  }

  async initialize() {
    await this.syncStatus.initialize();
    await this.serverConnector.initialize([
      this.receiveServerChangesPipe(),
      this.syncPipe(),
    ]);
  }

  private receiveServerChangesPipe() {
    return merge(
      of(null),
      this.serverConnector.socket$.pipe(
        switchMap((socket) =>
          fromEvent<RevisionWasChangedEvent>(
            socket,
            EventTypesFromServer.RevisionWasChanged,
          ),
        ),
      ),
      this.triggerGetChangesSubject,
    ).pipe(
      this.commandExecuter.send<GetChangesClientCommand>(() => ({
        type: CommandTypesFromClient.GetChanges,
        data: {
          lastReceivedRemoteRevision:
            this.syncStatus.value.lastReceivedRemoteRevision,
        },
      })),
      concatMap(async (res) => {
        if (res === null || res?.data?.status === 'error') {
          console.error('Failed to get changes');

          return;
        }

        const { data } = res;

        await this.db.transaction(
          'rw',
          [this.syncStatus.tableName, '_changesFromServer'],
          () => {
            console.log({ currentRevision: data.currentRevision });

            // If changes === 0 means such changes are already applied by client
            // And we are in sync with server
            const lastAppliedRemoteRevision =
              data.changes.length === 0
                ? data.currentRevision
                : this.syncStatus.value.lastAppliedRemoteRevision;

            this.syncStatus.update({
              lastReceivedRemoteRevision: data.currentRevision,
              lastAppliedRemoteRevision,
            });

            if (data.changes.length !== 0) {
              this.db.table<IServerChangesRow>('_changesFromServer').bulkAdd(
                data.changes.map((ch) => ({
                  id: v4(),
                  change: ch,
                  receivedAtRevisionOfServer: data.currentRevision,
                })),
              );
            }
          },
        );
      }),
    );
  }

  syncPipe() {
    const changesToSendTable =
      this.db.table<IChangeRowWithRev>('_changesToSend');
    const serverChangesToApplyTable =
      this.db.table<IServerChangesRow>('_changesFromServer');

    return merge(
      liveQuery(() => changesToSendTable.count()) as Observable<number>,
      liveQuery(() => serverChangesToApplyTable.count()) as Observable<number>,
    ).pipe(
      concatMap(async () => {
        const serverChanges = await serverChangesToApplyTable.toArray();

        if (serverChanges.length > 0) {
          await applyChanges(this.db, serverChanges);

          // TODO: resolve conflicts
        }

        const clientChanges = await changesToSendTable.toArray();

        if (clientChanges.length === 0) return of(null);

        const syncStatus = this.syncStatus.value;

        return of(null).pipe(
          this.commandExecuter.send(() => {
            return {
              type: CommandTypesFromClient.ApplyNewChanges,
              data: {
                changes: clientChanges.map((change) => ({
                  ...change,
                  source: syncStatus.source,
                })),
                partial: false,
                baseRevision: syncStatus.lastAppliedRemoteRevision,
              },
            };
          }),
          switchMap((res) => {
            if (res === null || res.data.status === 'error') {
              console.error('Failed to send changes');

              return of(null);
            }

            if (res?.data.status === 'staleChanges') {
              // Maybe server has newer changes. Let's await for new server changes and try to send again

              this.triggerGetChangesSubject.next(null);

              return of(null);
            }

            return this.db.transaction('rw', [changesToSendTable], () =>
              changesToSendTable.bulkDelete(
                clientChanges.map(({ rev }) => rev),
              ),
            );
          }),
        );
      }),
    );
  }

  private log = (msg: string) => {
    console.debug(`[${this.gatewayName}][${this.scopeId}] ${msg}`);
  };
}
