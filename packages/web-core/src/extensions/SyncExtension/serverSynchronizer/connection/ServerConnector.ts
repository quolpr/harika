import {
  Observable,
  of,
  ReplaySubject,
  combineLatest,
  defer,
  from,
} from 'rxjs';
import {
  distinctUntilChanged,
  map,
  share,
  switchMap,
  takeUntil,
  withLatestFrom,
} from 'rxjs/operators';
import io, { Socket } from 'socket.io-client';
import {
  AuthClientRequest,
  AuthClientResponse,
  CommandTypesFromClient,
} from '@harika/sync-common';

export class ServerConnector {
  isConnected$: Observable<boolean>;
  isConnectedAndReadyToUse$: Observable<boolean>;
  authedSocket$: Observable<Socket | undefined>;

  constructor(
    private dbName: string,
    private clientId: string,
    getAuthToken: () => Promise<string | undefined>,
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
      withLatestFrom(defer(() => from(getAuthToken()))),
      switchMap(([socket, authToken]) => {
        console.log({ authToken });

        if (socket && authToken) {
          return this.auth(socket, authToken);
        } else {
          return of(false);
        }
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
      const socket = io(`${this.syncUrl}/sync-db`);

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

  private auth(socket: Socket, authToken: string) {
    return new Observable<boolean>((obs) => {
      const req: AuthClientRequest = {
        authToken: authToken,
        dbName: this.dbName,
        clientId: this.clientId,
      };

      let isRunning = true;

      socket.emit(
        CommandTypesFromClient.Auth,
        req,
        (response: AuthClientResponse) => {
          if (!isRunning) return;

          if (response.status === 'success') {
            obs.next(true);
          } else {
            console.error('Failed to auth!');

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
