import { createLeaderElection } from 'broadcast-channel';
import { inject, injectable } from 'inversify';
import {
  Observable,
  ReplaySubject,
  share,
  startWith,
  Subject,
  switchMap,
} from 'rxjs';
import { STOP_SIGNAL } from '../../../framework/types';
import { getBroadcastCh$ } from '../../../lib/utils';
import { DB_NAME } from '../../DbExtension/types';
import { SyncRepository } from '../repositories/SyncRepository';
import { DbEventsListenService } from '../services/DbEventsListenerService';
import { SyncStatusService } from '../services/SyncStatusService';
import { SyncStateService } from '../SyncState';
import { GET_AUTH_TOKEN, SYNC_CONNECTION_ALLOWED, SYNC_URL } from '../types';
import { CommandsExecuter } from './CommandsExecuter';
import { ServerConnector } from './connection/ServerConnector';
import { ServerSynchronizer } from './ServerSynchronizer';

@injectable()
export class ServerSynchronizerFactory {
  constructor(
    @inject(SyncRepository)
    private syncRepo: SyncRepository,
    @inject(DB_NAME) private dbName: string,
    @inject(DbEventsListenService)
    private dbEventsListenService: DbEventsListenService,
    @inject(SYNC_CONNECTION_ALLOWED)
    private syncConnectionAllowed$: Subject<boolean>,
    @inject(SYNC_URL)
    private syncUrl: string,
    @inject(GET_AUTH_TOKEN)
    private getAuthToken: () => Promise<string>,
    @inject(STOP_SIGNAL)
    private stop$: Observable<unknown>,
    @inject(SyncStateService)
    private syncStateService: SyncStateService,
    @inject(SyncStatusService)
    private syncStatusService: SyncStatusService,
  ) {}

  async initialize() {
    const log = (msg: string) => {
      // console.debug(`[${dbName}] ${msg}`);
    };

    const syncStatus = await this.syncStatusService.getSyncStatus();
    const isLeader$ = this.getIsLeader$(this.dbName);

    const serverConnector = new ServerConnector(
      this.dbName,
      syncStatus.clientId,
      this.getAuthToken,
      this.syncUrl,
      isLeader$,
      this.syncConnectionAllowed$,
      this.stop$,
    );

    const commandExecuter = new CommandsExecuter(
      serverConnector.authedSocket$,
      log,
      this.stop$,
    );

    const syncer = new ServerSynchronizer(
      this.syncRepo,
      this.syncStatusService,
      commandExecuter,
      serverConnector,
      this.dbEventsListenService.changesChannel$(),
      this.stop$,
      log,
    );

    syncer.start();

    return {
      isConnected$: serverConnector.isConnected$,
      isConnectedAndReadyToUse$: serverConnector.isConnectedAndReadyToUse$,
      syncState$: this.syncStateService.initialize(
        syncer,
        serverConnector,
        isLeader$,
      ),
    };
  }

  private getIsLeader$(dbName: string) {
    return getBroadcastCh$(`syncLeader-${dbName}`).pipe(
      switchMap((ch) => {
        return new Observable<boolean>((observer) => {
          let isLeaderTracking = true;
          const elector = createLeaderElection(ch);

          elector.onduplicate = () => {
            if (!isLeaderTracking) return;
            observer.next(false);
          };

          elector
            .awaitLeadership()
            .then(() => {
              if (!isLeaderTracking) return;

              observer.next(true);
            })
            .catch(() => observer.error('Leadership error'));

          return () => {
            isLeaderTracking = false;
          };
        });
      }),
      startWith(false),
      share({
        connector: () => new ReplaySubject(1),
      }),
    );
  }
}
