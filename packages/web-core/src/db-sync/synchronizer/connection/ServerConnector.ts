import {
  merge,
  Subject,
  Observable,
  of,
  ReplaySubject,
  BehaviorSubject,
} from 'rxjs';
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
  socketSubject = new BehaviorSubject<Phoenix.Socket | undefined>(undefined);
  channelSubject = new BehaviorSubject<Phoenix.Channel | undefined>(undefined);
  isConnected$: Observable<boolean>;
  isConnectedAndReadyToUse$: Observable<boolean>;

  constructor(
    private dbName: string,
    private clientId: string,
    private url: string,
    private authToken: string,
    private isLeader$: Observable<boolean>,
    private log: (str: string) => void,
    private stop$: Subject<void>,
  ) {
    isLeader$.subscribe((isLeader) => {
      if (isLeader) {
        const socket = new Socket(this.url, {
          params: { token: this.authToken },
        });
        socket.connect();

        const phoenixChannel = socket.channel('db_changes:' + this.dbName, {
          client_id: this.clientId,
        });

        this.socketSubject.next(socket);
        this.channelSubject.next(phoenixChannel);
      } else {
        this.channelSubject.value?.leave();
        this.socketSubject.value?.disconnect();

        this.socketSubject.next(undefined);
        this.channelSubject.next(undefined);
      }
    });

    const connect$ = this.socketSubject.pipe(
      switchMap((socket) =>
        socket
          ? new Observable((observer) => {
              socket.onOpen(() => {
                observer.next();
              });
            })
          : of(),
      ),
    );

    const disconnect$ = this.socketSubject.pipe(
      switchMap(
        (socket) =>
          new Observable((observer) => {
            if (!socket) {
              observer.next();
              return;
            }

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
        return channel
          ? new Observable<boolean>((observer) => {
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
            })
          : of(false);
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
