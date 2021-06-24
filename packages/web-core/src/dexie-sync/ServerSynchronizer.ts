import { Dexie, liveQuery } from 'dexie';
import { v4 } from 'uuid';
import { fromEvent, merge, Subject, Observable, of, combineLatest } from 'rxjs';
import { concatMap, map, switchMap } from 'rxjs/operators';
import {
  EventTypesFromServer,
  CommandTypesFromClient,
  IDatabaseChange,
  RevisionWasChangedEvent,
  GetChangesClientCommand,
  DatabaseChangeType,
  ICreateChange,
  IUpdateChange,
} from '@harika/common';
import type { CommandsExecuter } from './CommandsExecuter';
import { applyChanges } from './applyChanges';
import type { SyncStatusService } from './SyncStatusService';
import type { ConnectionInitializer } from './connection/ConnectionInitializer';
import type { ServerConnector } from './connection/ServerConnector';
import { cloneDeep, set } from 'lodash-es';

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
  private triggerGetChangesSubject = new Subject<unknown>();
  isConnectedAndInitialized$: Observable<boolean>;

  constructor(
    private db: Dexie,
    private syncStatus: SyncStatusService,
    private commandExecuter: CommandsExecuter,
    private serverConnector: ServerConnector,
    private connectionInitializer: ConnectionInitializer,
    private stop$: Subject<void> = new Subject(),
  ) {
    this.isConnectedAndInitialized$ = combineLatest([
      this.serverConnector.isConnected$,
      this.connectionInitializer.isInitialized$,
    ]).pipe(
      map(([isConnected, isInitialized]) => isConnected && isInitialized),
    );
  }

  async initialize() {
    this.commandExecuter.start();
    await this.syncStatus.initialize();
    await this.serverConnector.initialize();
    this.connectionInitializer.initialize();

    this.receiveServerChangesPipe().subscribe();
    this.syncPipe().subscribe();

    this.isConnectedAndInitialized$
      .pipe(
        switchMap((isConnectedAndInitialized) => {
          if (isConnectedAndInitialized) {
            return merge(this.receiveServerChangesPipe(), this.syncPipe());
          } else {
            return of(null);
          }
        }),
      )
      .subscribe();
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
          fromRevision: this.syncStatus.value.lastReceivedRemoteRevision,
          includeSelf: false,
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
      concatMap(() => {
        return of(null).pipe(
          switchMap(async () => {
            const serverChanges = await serverChangesToApplyTable.toArray();

            if (serverChanges.length > 0) {
              await applyChanges(this.db, serverChanges);

              const clientChanges = await changesToSendTable.toArray();

              if (clientChanges.length !== 0 && serverChanges.length !== 0) {
                // TODO: transaction
                console.log(
                  'TODO: resolve conflicts!',
                  clientChanges,
                  serverChanges,
                );
              }
            }

            const clientChanges = await changesToSendTable.toArray();
            const syncStatus = this.syncStatus.value;

            return { clientChanges, syncStatus };
          }),
          switchMap(({ clientChanges, syncStatus }) => {
            if (clientChanges.length === 0) return of(null);

            return of(null).pipe(
              this.commandExecuter.send(() => {
                console.log('sending!');
                return {
                  type: CommandTypesFromClient.ApplyNewChanges,
                  data: {
                    changes: clientChanges.map((change) => ({
                      ...change,
                      source: syncStatus.source,
                    })),
                    partial: false,
                    lastAppliedRemoteRevision:
                      syncStatus.lastAppliedRemoteRevision,
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
      }),
    );
  }
}
