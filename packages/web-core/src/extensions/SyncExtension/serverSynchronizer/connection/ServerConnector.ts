import {
  CommandTypesFromClient,
  InitClientRequest,
  InitClientResponse,
} from '@harika/sync-common';
import { combineLatest, Observable, of, ReplaySubject } from 'rxjs';
import {
  distinctUntilChanged,
  map,
  share,
  switchMap,
  takeUntil,
} from 'rxjs/operators';
import io, { Socket } from 'socket.io-client';

export class ServerConnector {
  isConnected$: Observable<boolean>;
  isConnectedAndReadyToUse$: Observable<boolean>;
  authedSocket$: Observable<Socket | undefined>;

  constructor(
    private dbName: string,
    private clientId: string,
    private syncUrl: string,
    isLeader$: Observable<boolean>,
    isServerConnectionAllowed$: Observable<boolean>,
    stop$: Observable<unknown>,
  ) {
    const socket$ = combineLatest([isLeader$, isServerConnectionAllowed$]).pipe(
      switchMap(([isLeader, isServerConnectionAllowed]) => {
        if (isLeader && isServerConnectionAllowed) {
          console.log('initSocketIO');
          return this.initSocketIO();
        } else {
          return of(undefined);
        }
      }),
      distinctUntilChanged(),
      share({
        connector: () => new ReplaySubject(1),
        resetOnRefCountZero: false,
        resetOnError: false,
      }),
      takeUntil(stop$),
    );

    const isAuthed$ = socket$.pipe(
      distinctUntilChanged(),
      switchMap((socket) => {
        if (!socket) return of(false);

        return this.initClient(socket);
      }),
      share({
        connector: () => new ReplaySubject(1),
        resetOnRefCountZero: false,
        resetOnError: false,
      }),
      takeUntil(stop$),
    );

    this.isConnected$ = socket$.pipe(map((socket) => !!socket));
    this.isConnectedAndReadyToUse$ = combineLatest([socket$, isAuthed$]).pipe(
      map(([sock, isAuthed]) => Boolean(sock && isAuthed)),
    );

    this.authedSocket$ = combineLatest([socket$, isAuthed$]).pipe(
      map(([socket, isAuthed]) => (isAuthed ? socket : undefined)),
    );
  }

  private initSocketIO() {
    return new Observable<Socket | undefined>((obs) => {
      const socket = io(`${this.syncUrl}/sync-db`, { withCredentials: true });

      socket.on('connect', () => {
        obs.next(socket);
      });

      socket.on('disconnect', () => {
        // todo: reconnect logic
        obs.next(undefined);
      });

      socket.connect();

      return () => {
        socket.close();
      };
    });
  }

  private initClient(socket: Socket) {
    return new Observable<boolean>((obs) => {
      const req: InitClientRequest = {
        dbName: this.dbName,
        clientId: this.clientId,
      };

      let isRunning = true;

      socket.emit(
        CommandTypesFromClient.InitClient,
        req,
        (response: InitClientResponse) => {
          if (!isRunning) return;

          if (response.status === 'success') {
            obs.next(true);
          } else {
            console.error('Failed to initClient!');

            obs.next(false);
          }
        },
      );

      return () => {
        isRunning = false;
      };
    });
  }
}
