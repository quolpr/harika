import type { Dexie } from 'dexie';
import { merge, Subject, of } from 'rxjs';
import { concatMap, finalize, mapTo, switchMap } from 'rxjs/operators';
import type { IDatabaseChange } from '../dexieTypes';
import type { CommandsExecuter } from './CommandsExecuter';
import type { SyncStatusService } from './SyncStatusService';
import type { ServerConnector } from './connection/ServerConnector';
import { ServerChangesReceiver } from './ServerSynchronizer/ServerChangesReceiver';
import { ChangesApplierAndSender } from './ServerSynchronizer/ChangesApplierAndSender';

export interface IConsistencyResolver {
  resolve(): Promise<void>;
}

export interface IConflictsResolver {
  resolveChanges(
    clientChanges: IDatabaseChange[],
    serverChanges: IDatabaseChange[],
  ): void;

  tables(): Dexie.Table[];
}

export class ServerSynchronizer {
  private triggerGetChangesSubject = new Subject<unknown>();
  private serverChangesReceiver: ServerChangesReceiver;
  private changesApplierAndSender: ChangesApplierAndSender;

  constructor(
    db: Dexie,
    syncStatus: SyncStatusService,
    commandExecuter: CommandsExecuter,
    private serverConnector: ServerConnector,
    conflictResolver: IConflictsResolver,
    private stop$: Subject<void> = new Subject(),
    private log: (str: string) => void,
  ) {
    this.serverChangesReceiver = new ServerChangesReceiver(
      db,
      syncStatus,
      commandExecuter,
    );

    this.changesApplierAndSender = new ChangesApplierAndSender(
      db,
      syncStatus,
      commandExecuter,
      conflictResolver,
      this.triggerGetChangesSubject,
      this.log,
    );
  }

  async start() {
    this.serverConnector.isConnectedAndReadyToUse$
      .pipe(
        switchMap((isConnectedAndInitialized) => {
          if (isConnectedAndInitialized) {
            return this.handleOneCommandAtTimePipe();
          } else {
            return of(null);
          }
        }),
      )
      .subscribe();
  }

  handleOneCommandAtTimePipe() {
    let i = 0;

    const changesEmitter = this.serverChangesReceiver.emitter(
      this.serverConnector.channel$,
      this.triggerGetChangesSubject,
    );
    const changesPipe = this.serverChangesReceiver.pipe();

    const changesApplyAndSendEmitter = this.changesApplierAndSender.emitter();
    const changesApplyAndSendPipe = this.changesApplierAndSender.pipe();

    // Only one command at once
    return merge(
      changesEmitter.pipe(mapTo('getChanges' as const)),
      changesApplyAndSendEmitter.pipe(mapTo('applyChangesAndSend' as const)),
    ).pipe(
      concatMap((command) => {
        const id = i++;

        this.log(`[${id}] Executing command ${command}`);

        if (command === 'getChanges') {
          return of(null).pipe(
            changesPipe,
            finalize(() => {
              this.log(`[${id}] Done executing`);
            }),
          );
        } else {
          return of(null).pipe(
            changesApplyAndSendPipe,
            finalize(() => {
              this.log(`[${id}] Done executing`);
            }),
          );
        }
      }),
    );
  }
}
