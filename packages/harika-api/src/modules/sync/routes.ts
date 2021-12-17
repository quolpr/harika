import { FastifyPluginCallback } from 'fastify';
import { Server, Socket } from 'socket.io';
import {
  BehaviorSubject,
  catchError,
  mapTo,
  mergeMap,
  Observable,
  of,
  Subject,
  switchMap,
  takeUntil,
  tap,
  withLatestFrom,
} from 'rxjs';
import { createIfNotExistsDbSchema } from './createDbSchema';
import { DocSnapshotsService } from './services/DocSnapshotsService';
import { IncomingChangesHandler } from './services/IncomingChangesHandler';
import { ChangesService } from './services/changesService';
import { DocSnapshotRebuilder } from './services/DocSnapshotRebuilder';
import {
  ApplyNewChangesFromClientCommand,
  AuthClientCommand,
  ClientCommands,
  CommandTypesFromClient,
  EventsFromServer,
  GetSnapshotsClientCommand,
} from '@harika/sync-common';
import { getAuth } from 'firebase-admin/auth';
import { db } from '../../db/db';

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
            console.error('Error happened', err);
            callback({ status: 'error', errorType: 'internalError' });
          }

          return of();
        })
      );
    })
  );
}

class NotAuthedError extends Error {}

const docSnapshotsService = new DocSnapshotsService();
const changesService = new ChangesService();
const snapshotsRebuilder = new DocSnapshotRebuilder(
  changesService,
  docSnapshotsService
);
const incomingChangesHandler = new IncomingChangesHandler(
  db,
  changesService,
  snapshotsRebuilder,
  docSnapshotsService
);

export const syncHandler: FastifyPluginCallback = (server, options, next) => {
  const io = new Server(server.server, {
    maxHttpBufferSize: 1e8,
    cors: {
      origin: ['http://localhost:3000', 'https://app-dev.harika.io'],
      methods: ['GET', 'POST'],
    },
  });

  io.of('/sync-db').on('connection', function (socket) {
    const disconnect$ = new Subject();

    const authInfo$ = new BehaviorSubject<
      undefined | { dbName: string; userId: string; clientId: string }
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
        return of(null).pipe(
          switchMap(async () => {
            await socket.join(req.dbName);
          }),
          switchMap(async () => {
            return await getAuth().verifyIdToken(req.authToken);
          }),
          switchMap(async (token) => {
            await createIfNotExistsDbSchema(db, token.uid, req.dbName);

            return token;
          }),
          tap((decodedToken) => {
            authInfo$.next({
              dbName: req.dbName,
              userId: decodedToken.uid,
              clientId: req.clientId,
            });
          }),
          mapTo({ status: 'success' })
        );
      }
    )
      .pipe(takeUntil(disconnect$))
      .subscribe();

    handleMessage<ApplyNewChangesFromClientCommand>(
      socket,
      CommandTypesFromClient.ApplyNewChanges,
      (req) => {
        return authInfo$.pipe(
          onlyAuthed(),
          switchMap(async (authInfo) => ({
            snapshots: await incomingChangesHandler.handleIncomeChanges(
              authInfo.dbName,
              authInfo.clientId,
              req.changes
            ),
            status: 'success' as const,
          }))
        );
      }
    )
      .pipe(
        withLatestFrom(authInfo$),
        tap(([, authInfo]) => {
          io.of('/sync-db')
            .to(authInfo.dbName)
            .emit(EventsFromServer.RevisionChanged);
        }),
        takeUntil(disconnect$)
      )
      .subscribe();

    handleMessage<GetSnapshotsClientCommand>(
      socket,
      CommandTypesFromClient.GetSnapshots,
      (req) => {
        return authInfo$.pipe(
          onlyAuthed(),
          switchMap(async (authInfo) => {
            const snapshots = await docSnapshotsService.getSnapshotsFromRev(
              db,
              authInfo.dbName,
              req.fromRev
            );

            // TODO: race condition may happen here
            const { currentRev, lastTimestamp } =
              await docSnapshotsService.getStatus(db, authInfo.dbName);

            return {
              snapshots,
              currentRevision: currentRev,
              lastTimestamp: lastTimestamp,
              status: 'success' as const,
            };
          })
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
    res.send({ status: 'ok' });
  });

  next();
};
