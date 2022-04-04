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
import {
  FastifyRequest,
  FastifyResponse,
} from 'supertokens-node/lib/build/framework/fastify/framework';
import SessionRecipe from 'supertokens-node/lib/build/recipe/session/recipe';
import SuperTokens from 'supertokens-node/lib/build/supertokens';

import { db } from '../../db/db';
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

  namespaced.use(async (socket, done) => {
    let supertokens = SuperTokens.getInstanceOrThrowError();
    // console.log((socket.request as any).req, (socket.request as any).res);

    let request = new FastifyRequest(socket.request as any);
    let response = new FastifyResponse((socket.request as any).res);

    try {
      await supertokens.middleware(request, response);
    } catch (err) {
      await supertokens.errorHandler(err, request, response);
    }
    done();
  });

  namespaced.on('connection', async function (socket) {
    const disconnect$ = new Subject();

    let sessionRecipe = SessionRecipe.getInstanceOrThrowError();

    console.log(socket.request);
    const session = await sessionRecipe.verifySession(
      undefined,
      new FastifyRequest(socket.request as any),
      new FastifyResponse((socket.request as any).res)
    );

    const userId = session.getUserId();

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

    handleMessage<InitClientCommand>(
      socket,
      CommandTypesFromClient.Auth,
      (req) => {
        return of(null).pipe(
          switchMap(async () => {
            await socket.join(req.dbName);
          }),
          switchMap(async (token) => {
            await createIfNotExistsDbSchema(db, userId, req.dbName);

            return token;
          }),
          tap((decodedToken) => {
            authInfo$.next({
              dbName: req.dbName,
              userId: userId,
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
