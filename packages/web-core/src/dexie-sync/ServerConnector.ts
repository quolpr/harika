import type { Dexie } from 'dexie';
import io from 'socket.io-client';
import {
  BehaviorSubject,
  combineLatest,
  fromEvent,
  merge,
  Subject,
  Observable,
  of,
} from 'rxjs';
import {
  map,
  mapTo,
  mergeMap,
  shareReplay,
  switchMap,
  takeUntil,
} from 'rxjs/operators';
import { BroadcastChannel, createLeaderElection } from 'broadcast-channel';
import { CommandTypesFromClient, IDatabaseChange } from '@harika/common';
import { CommandsExecuter } from './CommandsExecuter';
import type { SyncStatusService } from './SyncStatusService';

export class ServerConnector {
  private socketSubject = new Subject<SocketIOClient.Socket>();
  private isInitialized$: BehaviorSubject<boolean> =
    new BehaviorSubject<boolean>(false);
  private isConnected$: Observable<boolean>;
  private isConnectedAndInitialized$: Observable<boolean>;
  socket$ = this.socketSubject.pipe(
    shareReplay({
      bufferSize: 1,
      refCount: true,
    }),
  );
  commandExecuter: CommandsExecuter;

  constructor(
    private db: Dexie,
    private scopeId: string,
    private url: string,
    private stop$: Subject<void>,
    private syncStatus: SyncStatusService,
    private log: (data: string) => void,
  ) {
    const connect$ = this.socket$.pipe(
      switchMap((socket) => fromEvent(socket, 'connect')),
    );

    const disconnect$ = this.socket$.pipe(
      mergeMap((socket) => fromEvent(socket, 'disconnect')),
    );

    this.isConnected$ = merge(
      connect$.pipe(mapTo(true)),
      disconnect$.pipe(mapTo(false)),
    ).pipe(
      takeUntil(this.stop$),
      shareReplay({
        refCount: true,
      }),
    );

    this.isConnectedAndInitialized$ = combineLatest([
      this.isConnected$,
      this.isInitialized$,
    ]).pipe(
      map(([isConnected, isInitialized]) => isConnected && isInitialized),
    );

    this.commandExecuter = new CommandsExecuter(
      this.log,
      this.socket$,
      this.isConnected$,
      this.stop$,
    );
  }

  async initialize(onConnect: Observable<unknown>[]) {
    this.connectWhenElected();

    this.isConnected$.subscribe((isConnected) => {
      console.log({ isConnected });
    });

    this.initializeOnConnectPipe().subscribe((isInitialized) => {
      this.isInitialized$.next(isInitialized);
    });

    this.isConnectedAndInitialized$
      .pipe(
        switchMap((isConnectedAndInitialized) => {
          if (isConnectedAndInitialized) {
            return merge(onConnect);
          } else {
            return of(null);
          }
        }),
      )
      .subscribe();
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

  private connectWhenElected() {
    const channel = new BroadcastChannel(`dexieSync-${this.db.name}`);
    // TODO: what to do with leader duplication?
    const elector = createLeaderElection(channel);

    elector.awaitLeadership().then(() => {
      const socket = io(this.url, { transports: ['websocket'] });

      this.socketSubject.next(socket);
    });
  }
}
