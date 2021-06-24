import { BehaviorSubject, combineLatest, merge, Observable, of } from 'rxjs';
import { map, mapTo, switchMap, takeUntil } from 'rxjs/operators';
import { CommandTypesFromClient } from '@harika/common';
import type { SyncStatusService } from '../SyncStatusService';
import type { CommandsExecuter } from '../CommandsExecuter';

export class ConnectionInitializer {
  isInitialized$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    false,
  );

  constructor(
    private isConnected$: Observable<boolean>,
    private commandExecuter: CommandsExecuter,
    private syncStatus: SyncStatusService,
    private scopeId: string,
    private stop$: Observable<void>,
  ) {}

  initialize() {
    this.initializeOnConnectPipe().subscribe((isInitialized) => {
      this.isInitialized$.next(isInitialized);
    });
  }

  private initializeOnConnectPipe() {
    return this.isConnected$.pipe(
      switchMap((isConnected) => {
        if (isConnected) {
          return of(null).pipe(
            this.commandExecuter.send(() => ({
              type: CommandTypesFromClient.InitializeClient,
              data: {
                identity: this.syncStatus.value.source,
                scopeId: this.scopeId,
              },
            })),
            mapTo(true),
          );
        } else {
          return of(false);
        }
      }),
      takeUntil(this.stop$),
    );
  }
}
