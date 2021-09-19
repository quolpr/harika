import { merge, Subject, Observable, of, ReplaySubject } from 'rxjs';
import {
  distinctUntilChanged,
  mapTo,
  share,
  switchMap,
  takeUntil,
} from 'rxjs/operators';
import { BroadcastChannel, createLeaderElection } from 'broadcast-channel';
import type Phoenix from 'phoenix';
import { Socket } from 'phoenix';

export class ServerConnector {
  socketSubject = new ReplaySubject<Phoenix.Socket>(1);
  channelSubject = new ReplaySubject<Phoenix.Channel>(1);
  isConnected$: Observable<boolean>;
  isConnectedAndReadyToUse$: Observable<boolean>;

  constructor(
    private dbName: string,
    private clientId: string,
    private url: string,
    private authToken: string,
    private log: (str: string) => void,
    private stop$: Subject<void>,
  ) {
    const connect$ = this.socketSubject.pipe(
      switchMap(
        (socket) =>
          new Observable((observer) => {
            socket.onOpen(() => {
              observer.next();
            });
          }),
      ),
    );

    const disconnect$ = this.socketSubject.pipe(
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
      share({
        connector: () => new ReplaySubject(1),
      }),
      takeUntil(this.stop$),
    );

    const isJoined$ = this.channelSubject.pipe(
      switchMap((channel) => {
        return new Observable<boolean>((observer) => {
          console.log('joining channel!');
          // On timeout/error phoenix will try to reconnect, so no need to handle such case
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
      share({
        connector: () => new ReplaySubject(1),
        resetOnRefCountZero: false,
        resetOnComplete: false,
        resetOnError: false,
      }),
      takeUntil(this.stop$),
    );

    this.isConnectedAndReadyToUse$ = this.isConnected$.pipe(
      switchMap((isConnected) => {
        return isConnected ? isJoined$ : of(false);
      }),
      distinctUntilChanged(),
      takeUntil(this.stop$),
      share({
        connector: () => new ReplaySubject(1),
      }),
    );

    this.connectWhenElected();
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
