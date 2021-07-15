import type { Dexie } from 'dexie';
import { merge, Subject, Observable } from 'rxjs';
import { mapTo, shareReplay, switchMap, takeUntil } from 'rxjs/operators';
import { BroadcastChannel, createLeaderElection } from 'broadcast-channel';
import Phoenix from 'phoenix';
import type { SyncStatusService } from '../SyncStatusService';

export class ServerConnector {
  private socketSubject = new Subject<Phoenix.Socket>();
  private channelSubject = new Subject<Phoenix.Channel>();
  isConnected$: Observable<boolean>;
  isConnectedAndReadyToUse$: Observable<boolean>;
  socket$ = this.socketSubject.pipe(
    shareReplay({
      bufferSize: 1,
      refCount: true,
    }),
  );
  channel$ = this.channelSubject.pipe(
    shareReplay({
      bufferSize: 1,
      refCount: true,
    }),
  );

  constructor(
    private db: Dexie,
    private url: string,
    private authToken: string,
    private syncStatus: SyncStatusService,
    private stop$: Subject<void>,
  ) {
    const connect$ = this.socket$.pipe(
      switchMap(
        (socket) =>
          new Observable((observer) => {
            socket.onOpen(() => {
              observer.next();
            });
          }),
      ),
    );

    const disconnect$ = this.socket$.pipe(
      switchMap(
        (socket) =>
          new Observable((observer) => {
            socket.onClose(() => {
              observer.next();
            });

            socket.onError(() => {
              observer.next();
            });
          }),
      ),
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

    this.isConnectedAndReadyToUse$ = this.channel$.pipe(
      switchMap(
        (channel) =>
          new Observable<boolean>((observer) => {
            channel
              .join()
              .receive('ok', ({ messages }) => {
                console.log('Joined channel', messages);

                observer.next(true);
              })
              .receive('error', ({ reason }) => {
                console.log('Channel error', reason);

                observer.next(false);
              })
              .receive('timeout', () => {
                observer.next(false);
              });
          }),
      ),
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
      const socket = new Phoenix.Socket(this.url, {
        params: { token: this.authToken },
      });
      socket.connect();

      const channel = socket.channel('db_changes:' + this.db.name, {
        client_id: this.syncStatus.value.clientId,
      });

      this.socketSubject.next(socket);
      this.channelSubject.next(channel);
    });
  }
}
