import { merge, Subject, Observable, of } from 'rxjs';
import {
  distinctUntilChanged,
  mapTo,
  shareReplay,
  switchMap,
  takeUntil,
} from 'rxjs/operators';
import { BroadcastChannel, createLeaderElection } from 'broadcast-channel';
import type Phoenix from 'phoenix';
import { Socket } from 'phoenix';

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
    private dbName: string,
    private clientId: string,
    private url: string,
    private authToken: string,
    private log: (str: string) => void,
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
      distinctUntilChanged(),
      takeUntil(this.stop$),
      shareReplay({
        refCount: true,
      }),
    );

    const isJoined$ = this.channel$.pipe(
      switchMap((channel) => {
        return new Observable<boolean>((observer) => {
          channel
            .join()
            .receive('ok', () => {
              this.log('Joined channel');

              observer.next(true);
            })
            .receive('error', ({ reason }) => {
              this.log(`Channel error - ${JSON.stringify(reason)}`);

              observer.next(false);
            })
            .receive('timeout', () => {
              this.log('Channel timeout');

              observer.next(false);
            });
        });
      }),
      distinctUntilChanged(),
      takeUntil(this.stop$),
      shareReplay({ refCount: false, bufferSize: 1 }),
    );

    isJoined$.subscribe();

    this.isConnectedAndReadyToUse$ = this.isConnected$.pipe(
      switchMap((isConnected) => {
        return isConnected ? isJoined$ : of(false);
      }),
      distinctUntilChanged(),
      takeUntil(this.stop$),
    );

    this.connectWhenElected();

    this.isConnected$.subscribe((isConnected) => {
      this.log(JSON.stringify({ isConnected }));
    });

    this.isConnectedAndReadyToUse$.subscribe((isConnectedAndReadyToUse) => {
      this.log(JSON.stringify({ isConnectedAndReadyToUse }));
    });
  }

  private connectWhenElected() {
    const channel = new BroadcastChannel(`dexieSync-${this.dbName}`);
    // TODO: what to do with leader duplication?
    const elector = createLeaderElection(channel);

    elector.awaitLeadership().then(async () => {
      const socket = new Socket(this.url, {
        params: { token: this.authToken },
      });
      socket.connect();

      const phoenixChannel = socket.channel('db_changes:' + this.dbName, {
        client_id: this.clientId,
      });

      this.socketSubject.next(socket);
      this.channelSubject.next(phoenixChannel);
    });
  }
}
