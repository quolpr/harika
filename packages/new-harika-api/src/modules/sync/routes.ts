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
} from 'rxjs';
import { createDbSchema, createIfNotExistsDbSchema } from './createDbSchema';
import { pg } from '../../plugins/db';
import { DocSnapshotsService } from './services/DocSnapshotsService';
import { IncomingChangesHandler } from './services/IncomingChangesHandler';
import { ChangesService } from './services/changesService';
import { DocSnapshotRebuilder } from './services/DocSnapshotRebuilder';
import {
  ApplyNewChangesFromClientCommand,
  AuthClientCommand,
  ClientCommands,
  CommandTypesFromClient,
  GetSnapshotsClientCommand,
} from '@harika/sync-common';

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

const docSnapshotsService = new DocSnapshotsService();
const changesService = new ChangesService();
const snapshotsRebuilder = new DocSnapshotRebuilder(
  changesService,
  docSnapshotsService
);
const incomingChangesHandler = new IncomingChangesHandler(
  pg,
  changesService,
  snapshotsRebuilder,
  docSnapshotsService
);

export const syncHandler: FastifyPluginCallback = (server, options, next) => {
  const io = new Server(server.server);

  io.on('connection', function (socket) {
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
          switchMap(() => createIfNotExistsDbSchema(pg, req.dbName)),
          tap(() => {
            authInfo$.next({
              dbName: req.dbName,
              userId: '123',
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
          }))
        );
      }
    )
      .pipe(takeUntil(disconnect$))
      .subscribe();

    handleMessage<GetSnapshotsClientCommand>(
      socket,
      CommandTypesFromClient.GetSnapshots,
      (req) => {
        return authInfo$.pipe(
          onlyAuthed(),
          switchMap(async (authInfo) => ({
            snapshots: await docSnapshotsService.getSnapshotsFromRev(
              pg,
              authInfo.dbName,
              req.fromRev
            ),
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
