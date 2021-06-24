import type { Dexie } from 'dexie';
import io from 'socket.io-client';
import { fromEvent, merge, Subject, Observable } from 'rxjs';
import {
  mapTo,
  mergeMap,
  shareReplay,
  switchMap,
  takeUntil,
} from 'rxjs/operators';
import { BroadcastChannel, createLeaderElection } from 'broadcast-channel';

export class ServerConnector {
  private socketSubject = new Subject<SocketIOClient.Socket>();
  isConnected$: Observable<boolean>;
  socket$ = this.socketSubject.pipe(
    shareReplay({
      bufferSize: 1,
      refCount: true,
    }),
  );

  constructor(
    private db: Dexie,
    private url: string,
    private stop$: Subject<void>,
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
  }

  async initialize() {
    this.connectWhenElected();

    this.isConnected$.subscribe((isConnected) => {
      console.log({ isConnected });
    });
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
