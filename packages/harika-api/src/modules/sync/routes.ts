import {
  ApplyNewChangesFromClientCommand,
  ClientCommands,
  CommandTypesFromClient,
  EventsFromServer,
  GetSnapshotsClientCommand,
  InitClientCommand,
} from '@harika/sync-common';
import { FastifyPluginCallback } from 'fastify';
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
import { Server, Socket } from 'socket.io';

import { db } from '../../db/db';
import { oryClient } from '../../oryClient';
import { createIfNotExistsDbSchema } from './createDbSchema';
import { ChangesService } from './services/changesService';
import { DocSnapshotsService } from './services/DocSnapshotsService';
import { IncomingChangesHandler } from './services/IncomingChangesHandler';

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
const incomingChangesHandler = new IncomingChangesHandler(
  db,
  changesService,
  docSnapshotsService
);

export const syncHandler: FastifyPluginCallback = (server, options, next) => {
  const io = new Server(server.server, {
    maxHttpBufferSize: 1e8,
    cors: {
      origin: ['http://localhost:3000', 'https://app-dev.harika.io'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  const namespaced = io.of('/sync-db');
  namespaced.on('connection', async function (socket) {
    const disconnect$ = new Subject();

    if (!socket.request.headers?.cookie) {
      console.error('No cookie set');

      socket.disconnect();

      return;
    }

    const authInfo$ = new BehaviorSubject<
      undefined | { dbName: string; clientId: string; userId: string }
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

    handleMessage<InitClientCommand>(
      socket,
      CommandTypesFromClient.InitClient,
      (req) => {
        return of(null).pipe(
          switchMap(async () => {
            const response = await oryClient.toSession(
              undefined,
              socket.request.headers?.cookie
            );

            return response.data.identity.id;
          }),

          switchMap(async (userId) => {
            await socket.join(req.dbName);

            return userId;
          }),
          switchMap(async (userId) => {
            await createIfNotExistsDbSchema(db, userId, req.dbName);

            return userId;
          }),
          tap((userId) => {
            console.log(
              `User ${userId}(clientId = ${req.clientId}) is connected to ${req.dbName} and authed`
            );

            authInfo$.next({
              dbName: req.dbName,
              clientId: req.clientId,
              userId,
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
            // TODO: could be done in one query
            const snapshots = await docSnapshotsService.getSnapshotsFromRev(
              db,
              authInfo.dbName,
              req.fromRev,
              await changesService.getDocIdsAfterRevExceptSelf(
                db,
                authInfo.dbName,
                req.fromRev,
                authInfo.clientId
              )
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
