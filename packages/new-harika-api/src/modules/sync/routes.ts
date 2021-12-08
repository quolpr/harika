import { FastifyPluginCallback } from 'fastify';
import { Server, Socket } from 'socket.io';
import {
  BehaviorSubject,
  catchError,
  map,
  mergeMap,
  Observable,
  of,
  Subject,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';
import { IDocChange } from './types';
import { createDbSchema } from './createDbSchema';

type IRequestToServer = {};
type IResponseFromServer = {};

export enum CommandTypesFromClient {
  ApplyNewChanges = 'applyNewChanges',
  GetChanges = 'getChanges',
  Auth = 'auth',
}

type InternalErrorResponse = { status: 'error'; errorType: 'internalError' };
type NotAuthedResponse = { status: 'error'; errorType: 'notAuted' };

type ErrorResponse = InternalErrorResponse | NotAuthedResponse;

export type AuthClientCommand = {
  type: CommandTypesFromClient.Auth;

  request: AuthClientRequest;
  response: AuthClientResponse;
};

export interface AuthClientRequest {
  authToken: string;
  dbName: string;
}

export type AuthClientResponse = {
  status: 'success' | 'failed';
};

export type ApplyNewChangesFromClientCommand = {
  type: CommandTypesFromClient.ApplyNewChanges;

  request: ApplyNewChangesFromClientRequest;
  response: ApplyNewChangesFromClientResponse | ErrorResponse;
};

export interface ApplyNewChangesFromClientRequest {
  changes: IDocChange[];
  partial: boolean;
  lastAppliedRemoteRevision: number | null;
}

export type ApplyNewChangesFromClientResponse =
  | {
      status: 'success';
      newRev: number;
    }
  | {
      status: 'staleChanges' | 'locked';
    };

export type GetChangesClientCommand = {
  type: CommandTypesFromClient.GetChanges;

  request: GetChangesRequest;
  response: GetChangesResponse | ErrorResponse;
};

export interface GetChangesRequest {
  fromServerTime: number;
  includeSelf: false;
}

export interface GetChangesResponse {
  changes: (IDocChange & { clock: string })[];
  lastServerTime: number;
}

export type ClientCommands =
  | GetChangesClientCommand
  | ApplyNewChangesFromClientCommand
  | AuthClientCommand;

export type ClientCommandRequests =
  | GetChangesRequest
  | ApplyNewChangesFromClientRequest;

export type ClientCommandResponses =
  | GetChangesResponse
  | ApplyNewChangesFromClientResponse;

function handleMessage<T extends ClientCommands>(
  socket: Socket,
  type: T['type'],
  func: (req: T['request']) => Observable<T['response']>
) {
  return of(socket).pipe(
    switchMap((socket) => {
      return new Observable<[T['request'], (arg: T['response']) => void]>(
        (obs) => {
          socket.on(type as string, async (msg, callback) => {
            console.log({ msg, callback });
            obs.next([msg, callback]);
          });
        }
      );
    }),
    mergeMap(([msg, callback]) => {
      return func(msg).pipe(
        tap((res) => {
          callback(res);
        }),
        catchError((err: unknown) => {
          if (err instanceof NotAuthedError) {
            callback({ status: 'error', errorType: 'notAuted' });
          } else {
            callback({ status: 'error', errorType: 'internalError' });
          }

          return of();
        })
      );
    })
  );
}

class NotAuthedError extends Error {}

export const syncHandler: FastifyPluginCallback = (server, options, next) => {
  const io = new Server(server.server);

  io.on('connection', function (socket) {
    const disconnect$ = new Subject();

    const authInfo$ = new BehaviorSubject<
      undefined | { dbName: string; userId: string }
    >(undefined);

    const onlyAuthed = () => {
      return function <T>(source: Observable<T>): Observable<T> {
        return authInfo$.pipe(
          switchMap((authInfo) => {
            if (!authInfo) {
              throw new NotAuthedError();
            } else {
              return source;
            }
          })
        );
      };
    };

    handleMessage<AuthClientCommand>(
      socket,
      CommandTypesFromClient.Auth,
      (req) => {
        authInfo$.next({ dbName: req.dbName, userId: '123' });

        return of({ status: 'success' });
      }
    )
      .pipe(takeUntil(disconnect$))
      .subscribe();

    handleMessage<GetChangesClientCommand>(
      socket,
      CommandTypesFromClient.GetChanges,
      (req) => {
        return of(null).pipe(
          onlyAuthed(),
          map(() => ({
            changes: [],
            lastServerTime: 0,
          }))
        );
      }
    )
      .pipe(takeUntil(disconnect$))
      .subscribe();

    socket.on('disconnect', () => {
      disconnect$.next(true);
    });
  });

  server.get('/', async (req, res) => {
    await createDbSchema(req.db, 'db_user3');

    res.send({ status: 'ok' });
  });

  next();
};
