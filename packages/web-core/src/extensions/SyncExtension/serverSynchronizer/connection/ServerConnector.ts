import { Observable, of, ReplaySubject, combineLatest } from 'rxjs';
import {
  distinctUntilChanged,
  map,
  share,
  switchMap,
  takeUntil,
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
    private url: string,
    private authToken: string,
    isLeader$: Observable<boolean>,
    isServerConnectionAllowed$: Observable<boolean>,
    stop$: Observable<unknown>,
  ) {
    const socket$ = combineLatest([isLeader$, isServerConnectionAllowed$]).pipe(
      switchMap(([isLeader, isServerConnectionAllowed]) => {
        if (isLeader && isServerConnectionAllowed) {
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

    socket$.subscribe((s) => {
      console.log({ s });
    });

    const isAuthed$ = socket$.pipe(
      distinctUntilChanged(),
      switchMap((socket) => {
        if (socket) {
          return this.auth(socket);
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
      const socket = io(`${this.url}/sync-db`);

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

  private auth(socket: Socket) {
    return new Observable<boolean>((obs) => {
      const req: AuthClientRequest = {
        authToken: this.authToken,
        dbName: this.dbName,
        clientId: this.clientId,
      };

      console.log({ req });

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
