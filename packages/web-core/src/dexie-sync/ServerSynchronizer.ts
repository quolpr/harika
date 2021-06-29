import { Dexie, liveQuery } from 'dexie';
import { v4 } from 'uuid';
import {
  fromEvent,
  merge,
  Subject,
  Observable,
  of,
  combineLatest,
  pipe,
  from,
} from 'rxjs';
import { concatMap, filter, map, mapTo, switchMap } from 'rxjs/operators';
import {
  EventTypesFromServer,
  CommandTypesFromClient,
  IDatabaseChange,
  RevisionWasChangedEvent,
  GetChangesClientCommand,
  DatabaseChangeType,
} from '@harika/common';
import type { CommandsExecuter } from './CommandsExecuter';
import type { SyncStatusService } from './SyncStatusService';
import type { ConnectionInitializer } from './connection/ConnectionInitializer';
import type { ServerConnector } from './connection/ServerConnector';
import { maxBy, omit } from 'lodash-es';

type IChangeRow = DistributiveOmit<IDatabaseChange, 'source'>;
type IChangeRowWithRev = IChangeRow & {
  rev: string;
};

export interface IServerChangesRow {
  id: string;
  change: IDatabaseChange;
  receivedAtRevisionOfServer: number;
}

export interface IConflictsResolver {
  resolveChanges(
    clientChanges: IDatabaseChange[],
    serverChanges: IDatabaseChange[],
  ): Promise<void>;

  tables(): Dexie.Table[];
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
    private conflictResolver: IConflictsResolver,
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

    this.isConnectedAndInitialized$
      .pipe(
        switchMap((isConnectedAndInitialized) => {
          if (isConnectedAndInitialized) {
            const { emitter: changesEmitter, pipe: changesPipe } =
              this.receiveServerChanges();

            const { emitter: syncEmitter, pipe: syncPipe } = this.sync();

            // Only one command at once
            return merge(
              changesEmitter.pipe(mapTo('getChanges' as const)),
              syncEmitter.pipe(mapTo('syncChanges' as const)),
            ).pipe(
              concatMap((command) => {
                if (command === 'getChanges') {
                  return of(null).pipe(changesPipe);
                } else {
                  return of(null).pipe(syncPipe);
                }
              }),
            );
          } else {
            return of(null);
          }
        }),
      )
      .subscribe();
  }

  private receiveServerChanges() {
    const changesPipe = pipe(
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
          async () => {
            console.log({ currentRevision: data.currentRevision });
            const currentChangesCount = await this.db
              .table<IServerChangesRow>('_changesFromServer')
              .count();

            // If changes === 0 means such changes are already applied by client
            // And we are in sync with server
            const lastAppliedRemoteRevision =
              data.changes.length === 0 && currentChangesCount === 0
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

    return {
      emitter: merge(
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
      ),
      pipe: changesPipe,
    };
  }

  sync() {
    const changesToSendTable =
      this.db.table<IChangeRowWithRev>('_changesToSend');
    const serverChangesToApplyTable =
      this.db.table<IServerChangesRow>('_changesFromServer');

    const emitter = merge(
      from(
        liveQuery(() => changesToSendTable.count()) as Observable<number>,
      ).pipe(filter((c) => c > 0)),
      from(
        liveQuery(() =>
          serverChangesToApplyTable.count(),
        ) as Observable<number>,
      ).pipe(filter((c) => c > 0)),
    );

    const syncPipe = pipe(
      switchMap(() => this.resolveConflicts()),
      switchMap(({ clientChanges, syncStatus }) => {
        if (clientChanges.length === 0) return of(null);

        return of(null).pipe(
          this.commandExecuter.send(() => {
            console.log('sending!');
            return {
              type: CommandTypesFromClient.ApplyNewChanges,
              data: {
                changes: clientChanges.map((change) => ({
                  ...(change.type === DatabaseChangeType.Update
                    ? omit(change, 'obj')
                    : change),
                  source: syncStatus.source,
                })),
                partial: false,
                lastAppliedRemoteRevision: syncStatus.lastAppliedRemoteRevision,
              },
            };
          }),
          switchMap((res) => {
            if (res === null || res.data.status === 'error') {
              console.error('Failed to send changes');

              return of(null);
            }

            if (res.data.status === 'locked') {
              console.log('Locked. Just waiting for new changes');

              return of(null);
            }

            if (res?.data.status === 'staleChanges') {
              // Maybe server has newer changes. Let's await for new server changes and try to send again

              console.log('staled changes');
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

    return { emitter, pipe: syncPipe };
  }

  private resolveConflicts = async () => {
    const changesToSendTable =
      this.db.table<IChangeRowWithRev>('_changesToSend');
    const serverChangesToApplyTable =
      this.db.table<IServerChangesRow>('_changesFromServer');

    const serverChanges = await serverChangesToApplyTable.toArray();

    if (serverChanges.length > 0) {
      const clientChanges = await changesToSendTable.toArray();

      await this.db.transaction(
        'rw',
        [
          ...this.db.tables,
          this.db.table('_changesFromServer'),
          this.db.table('_syncStatus'),
        ],
        async () => {
          if (clientChanges.length === 0) {
            // @ts-ignore
            Dexie.currentTransaction.source = 'serverChanges';
          } else {
            // @ts-ignore
            Dexie.currentTransaction.source = 'conflictsResolution';
          }

          await this.conflictResolver.resolveChanges(
            clientChanges.map((change) => ({
              ...change,
              source: this.syncStatus.value.source,
            })),
            serverChanges.map(({ change }) => change),
          );

          const maxRevision = maxBy(
            serverChanges,
            ({ receivedAtRevisionOfServer }) => receivedAtRevisionOfServer,
          )?.receivedAtRevisionOfServer;

          if (maxRevision === undefined)
            throw new Error('Max revision could not be undefined');

          await serverChangesToApplyTable.bulkDelete(
            serverChanges.map(({ id }) => id),
          );

          const lastAppliedRemoteRevision =
            (await serverChangesToApplyTable.count()) === 0
              ? this.syncStatus.value.lastReceivedRemoteRevision
              : maxRevision;

          await this.syncStatus.update({
            lastAppliedRemoteRevision,
          });
        },
      );
    }

    const clientChanges = await changesToSendTable.toArray();
    const syncStatus = this.syncStatus.value;

    return { clientChanges, syncStatus };
  };
}
