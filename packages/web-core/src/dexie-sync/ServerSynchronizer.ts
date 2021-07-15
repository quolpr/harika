import { Dexie, liveQuery } from 'dexie';
import { v4 } from 'uuid';
import { merge, Subject, Observable, of, pipe, from } from 'rxjs';
import { concatMap, filter, mapTo, switchMap, tap } from 'rxjs/operators';
import {
  CommandTypesFromClient,
  IDatabaseChange,
  GetChangesClientCommand,
  DatabaseChangeType,
  ApplyNewChangesFromClientCommand,
} from '@harika/common';
import type { CommandsExecuter } from './CommandsExecuter';
import type { SyncStatusService } from './SyncStatusService';
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

  constructor(
    private db: Dexie,
    private syncStatus: SyncStatusService,
    private commandExecuter: CommandsExecuter,
    private serverConnector: ServerConnector,
    private conflictResolver: IConflictsResolver,
    private stop$: Subject<void> = new Subject(),
  ) {}

  async initialize() {
    await this.syncStatus.initialize();
    await this.serverConnector.initialize();

    this.serverConnector.isConnectedAndReadyToUse$
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
      this.commandExecuter.send<GetChangesClientCommand>(
        CommandTypesFromClient.GetChanges,
        () => ({
          fromRevision: this.syncStatus.value.lastReceivedRemoteRevision,
          includeSelf: false,
        }),
      ),
      concatMap(async (res) => {
        if (res === null) {
          console.error('Failed to get changes');

          return;
        }

        await this.db.transaction(
          'rw',
          [this.syncStatus.tableName, '_changesFromServer'],
          async () => {
            console.log({ currentRevision: res.currentRevision, res });
            const currentChangesCount = await this.db
              .table<IServerChangesRow>('_changesFromServer')
              .count();

            // If changes === 0 means such changes are already applied by client
            // And we are in sync with server
            const lastAppliedRemoteRevision =
              res.changes.length === 0 && currentChangesCount === 0
                ? res.currentRevision
                : this.syncStatus.value.lastAppliedRemoteRevision;

            this.syncStatus.update({
              lastReceivedRemoteRevision: res.currentRevision,
              lastAppliedRemoteRevision,
            });

            if (res.changes.length !== 0) {
              this.db.table<IServerChangesRow>('_changesFromServer').bulkAdd(
                res.changes.map((ch) => ({
                  id: ch.id,
                  change: ch,
                  receivedAtRevisionOfServer: res.currentRevision,
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
        this.serverConnector.channel$.pipe(
          switchMap((channel) => {
            return new Observable((observer) => {
              channel.on('revision_was_changed', () => {
                console.log(this.db.name, 'revision_was_changed!');
                observer.next();
              });
            });
          }),
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
          this.commandExecuter.send<ApplyNewChangesFromClientCommand>(
            CommandTypesFromClient.ApplyNewChanges,
            () => {
              return {
                changes: clientChanges.map((change) => ({
                  ...(change.type === DatabaseChangeType.Update
                    ? omit(change, 'obj')
                    : change),
                  source: syncStatus.clientId,
                })),
                partial: false,
                lastAppliedRemoteRevision: syncStatus.lastAppliedRemoteRevision,
              };
            },
          ),
          switchMap((res) => {
            if (!res) return of(null);

            if (res.status === 'locked') {
              console.log('Locked. Just waiting for new changes');

              return of(null);
            }

            if (res.status === 'stale_changes') {
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
          await this.conflictResolver.resolveChanges(
            clientChanges.map((change) => ({
              ...change,
              source: this.syncStatus.value.clientId,
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
