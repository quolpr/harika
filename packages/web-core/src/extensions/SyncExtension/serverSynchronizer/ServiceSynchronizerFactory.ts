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
import { ApplyChangesService } from '../services/ApplyChangesService';
import { SyncRepository } from '../repositories/SyncRepository';
import { DbEventsListenService } from '../services/DbEventsListenerService';
import { SyncStateService } from '../SyncState';
import {
  SYNC_AUTH_TOKEN,
  SYNC_CONNECTION_ALLOWED,
  SYNC_URL,
} from '../types';
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
    @inject(SYNC_AUTH_TOKEN)
    private syncAuthToken: string,
    @inject(ApplyChangesService)
    private applyChangesService: ApplyChangesService,
    @inject(STOP_SIGNAL)
    private stop$: Observable<unknown>,
    @inject(SyncStateService)
    private syncStateService: SyncStateService,
  ) {}

  async initialize() {
    const log = (msg: string) => {
      // console.debug(`[${dbName}] ${msg}`);
    };

    const syncStatus = await this.syncRepo.getSyncStatus();
    const isLeader$ = this.getIsLeader$(this.dbName);

    const serverConnector = new ServerConnector(
      this.dbName,
      syncStatus.clientId,
      this.syncUrl,
      this.syncAuthToken,
      isLeader$,
      this.syncConnectionAllowed$,
      log,
      this.stop$,
    );

    const commandExecuter = new CommandsExecuter(
      serverConnector.socketSubject,
      serverConnector.channelSubject,
      log,
      this.stop$,
    );

    const syncer = new ServerSynchronizer(
      this.syncRepo,
      this.applyChangesService,
      commandExecuter,
      serverConnector,
      this.dbEventsListenService.changesChannel$(),
      this.dbEventsListenService.newSyncPullsChannel$(),
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
          const elector = createLeaderElection(ch);

          elector.awaitLeadership().then(() => {
            observer.next(true);
          });

          elector.onduplicate = () => {
            observer.next(false);
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
