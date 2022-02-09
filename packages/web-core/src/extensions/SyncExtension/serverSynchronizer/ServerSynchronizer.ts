import { BehaviorSubject,merge, Observable, of, Subject } from 'rxjs';
import {
  concatMap,
  finalize,
  map,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs/operators';

import type { SyncRepository } from '../repositories/SyncRepository';
import { SyncStatusService } from '../services/SyncStatusService';
import type { CommandsExecuter } from './CommandsExecuter';
import type { ServerConnector } from './connection/ServerConnector';
import { ChangesSender } from './ServerSynchronizer/ChangesSender';
import { ServerSnapshotsReceiver } from './ServerSynchronizer/ServerChangesReceiver';

export interface IConsistencyResolver {
  resolve(): Promise<void>;
}

export class ServerSynchronizer {
  private serverSnapshotsReceiver: ServerSnapshotsReceiver;
  private changesSender: ChangesSender;
  public isSyncing$ = new BehaviorSubject<boolean>(false);

  constructor(
    syncRepo: SyncRepository,
    syncStatusService: SyncStatusService,
    commandExecuter: CommandsExecuter,
    private serverConnector: ServerConnector,
    onNewChange$: Observable<unknown>,
    private stop$: Observable<unknown> = new Subject(),
    private log: (str: string) => void,
  ) {
    this.serverSnapshotsReceiver = new ServerSnapshotsReceiver(
      syncRepo,
      syncStatusService,
      commandExecuter,
    );

    this.changesSender = new ChangesSender(
      syncRepo,
      syncStatusService,
      commandExecuter,
      onNewChange$,
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
      this.changesSender.get$().pipe(
        map((observer) => ({
          observer,
          commandName: 'applyChangesAndSend' as const,
        })),
      ),
      this.serverSnapshotsReceiver
        .get$(this.serverConnector.authedSocket$)
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
