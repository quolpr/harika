import { merge, Subject, of, Observable, BehaviorSubject } from 'rxjs';
import {
  concatMap,
  finalize,
  map,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs/operators';
import type { CommandsExecuter } from './CommandsExecuter';
import type { ServerConnector } from './connection/ServerConnector';
import { ServerChangesReceiver } from './ServerSynchronizer/ServerChangesReceiver';
import { ChangesApplierAndSender } from './ServerSynchronizer/ChangesApplierAndSender';
import type { IDatabaseChange } from './types';
import type { SyncRepository } from '../../worker/repositories/SyncRepository';
import type { ApplyChangesService } from '../../worker/services/ApplyChangesService';

export interface IConsistencyResolver {
  resolve(): Promise<void>;
}

export interface IChangesApplier {
  resolveChanges(
    clientChanges: IDatabaseChange[],
    serverChanges: IDatabaseChange[],
  ): {
    conflictedChanges: IDatabaseChange[];
    notConflictedServerChanges: IDatabaseChange[];
  };
}

export class ServerSynchronizer {
  private triggerGetChangesSubject = new Subject<unknown>();
  private serverChangesReceiver: ServerChangesReceiver;
  private changesApplierAndSender: ChangesApplierAndSender;
  public isSyncing$ = new BehaviorSubject<boolean>(false);

  constructor(
    syncRepo: SyncRepository,
    applyChangesService: ApplyChangesService,
    commandExecuter: CommandsExecuter,
    private serverConnector: ServerConnector,
    onNewChange$: Observable<unknown>,
    onNewPull$: Observable<unknown>,
    private stop$: Observable<unknown> = new Subject(),
    private log: (str: string) => void,
  ) {
    this.serverChangesReceiver = new ServerChangesReceiver(
      syncRepo,
      commandExecuter,
    );

    this.changesApplierAndSender = new ChangesApplierAndSender(
      syncRepo,
      applyChangesService,
      commandExecuter,
      this.triggerGetChangesSubject,
      this.log,
      onNewChange$,
      onNewPull$,
    );
  }

  start() {
    this.serverConnector.isConnectedAndReadyToUse$
      .pipe(
        switchMap((isConnectedAndInitialized) => {
          if (isConnectedAndInitialized) {
            return this.handleOneCommandAtTimePipe();
          } else {
            return of(null);
          }
        }),
        takeUntil(this.stop$),
      )
      .subscribe();
  }

  handleOneCommandAtTimePipe() {
    let i = 0;

    // Only one command at once
    return merge(
      this.changesApplierAndSender.get$().pipe(
        map((observer) => ({
          observer,
          commandName: 'applyChangesAndSend' as const,
        })),
      ),
      this.serverChangesReceiver
        .get$(
          this.serverConnector.channelSubject,
          this.triggerGetChangesSubject,
        )
        .pipe(
          map((observer) => ({
            observer,
            commandName: 'getChanges' as const,
          })),
        ),
    ).pipe(
      tap(() => {
        this.isSyncing$.next(true);
      }),
      concatMap(({ observer, commandName }) => {
        const id = i++;

        this.log(`[${id}] Executing command ${commandName}`);

        return observer.pipe(
          finalize(() => {
            this.isSyncing$.next(false);
            this.log(`[${id}] Done executing`);
          }),
        );
      }),
    );
  }
}
