import { createLeaderElection } from 'broadcast-channel';
import { Remote } from 'comlink';
import { inject, injectable } from 'inversify';
import { isEqual } from 'lodash-es';
import {
  distinctUntilChanged,
  interval,
  map,
  merge,
  Observable,
  ReplaySubject,
  share,
  startWith,
  switchMap,
  tap,
  withLatestFrom,
} from 'rxjs';
import { STOP_SIGNAL } from '../../../framework/types';
import { toRemoteName } from '../../../framework/utils';
import { getBroadcastCh$ } from '../../../lib/utils';
import { DB_NAME } from '../../DbExtension/types';
import { ApplyChangesService } from '../persistence/ApplyChangesService';
import { SyncRepository } from '../persistence/SyncRepository';
import { DbEventsListenService } from '../services/DbEventsListenerService';
import { SYNC_AUTH_TOKEN, SYNC_CONNECTION_ALLOWED, SYNC_URL } from '../types';
import { CommandsExecuter } from './CommandsExecuter';
import { ServerConnector } from './connection/ServerConnector';
import { ISyncState, defaultSyncState } from './init';
import { ServerSynchronizer } from './ServerSynchronizer';

@injectable()
export class ServerSynchronizerFactory {
  constructor(
    @inject(toRemoteName(SyncRepository))
    private syncRepo: Remote<SyncRepository>,
    @inject(DB_NAME) private dbName: string,
    @inject(DbEventsListenService)
    private dbEventsListenService: DbEventsListenService,
    @inject(SYNC_CONNECTION_ALLOWED)
    private syncConnectionAllowed$: Observable<boolean>,
    @inject(SYNC_URL)
    private syncUrl: string,
    @inject(SYNC_AUTH_TOKEN)
    private syncAuthToken: string,
    @inject(toRemoteName(ApplyChangesService))
    private applyChangesService: Remote<ApplyChangesService>,
    @inject(STOP_SIGNAL)
    private stop$: Observable<unknown>,
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
      syncState$: this.getSyncState$(syncer, serverConnector, isLeader$),
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

  private getSyncState$(
    syncer: ServerSynchronizer,
    serverConnector: ServerConnector,
    isLeader$: Observable<boolean>,
  ) {
    const storageKey = `sync-state-${this.dbName}`;

    const stateFormer = merge(
      this.dbEventsListenService.changesChannel$(),
      this.dbEventsListenService.newSyncPullsChannel$(),
      syncer.isSyncing$,
      serverConnector.isConnected$,
      serverConnector.isConnectedAndReadyToUse$,
      interval(10_000),
    ).pipe(
      startWith(null),
      switchMap(async () => {
        const [serverCount, clientCount] =
          await this.syncRepo.getServerAndClientChangesCount();

        return {
          isSyncing: syncer.isSyncing$.value,
          pendingClientChangesCount: clientCount,
          pendingServerChangesCount: serverCount,
        };
      }),
      withLatestFrom(
        serverConnector.isConnected$,
        (partialState, isConnected) => ({ ...partialState, isConnected }),
      ),
      withLatestFrom(
        serverConnector.isConnectedAndReadyToUse$,
        (partialState, isConnectedAndReadyToUse) => ({
          ...partialState,
          isConnectedAndReadyToUse,
        }),
      ),
      distinctUntilChanged((a, b) => isEqual(a, b)),
      tap((state) => {
        localStorage.setItem(storageKey, JSON.stringify(state));
      }),
      share({
        connector: () => new ReplaySubject(1),
      }),
    );

    const stateGetter = new Observable<string | null>((obs) => {
      console.log('start listening!');
      const callback = () => {
        obs.next(localStorage.getItem(storageKey));
      };
      window.addEventListener('storage', callback);

      obs.next(localStorage.getItem(storageKey));
      return () => {
        window.removeEventListener('storage', callback);
      };
    }).pipe(
      distinctUntilChanged(),
      map((val): ISyncState => (val ? JSON.parse(val) : defaultSyncState)),
    );

    return isLeader$.pipe(
      switchMap((isLeader) => {
        return isLeader ? stateFormer : stateGetter;
      }),
      withLatestFrom(isLeader$, (partialState, isLeader) => ({
        ...partialState,
        isLeader,
        dbName: this.dbName,
      })),
    );
  }
}
