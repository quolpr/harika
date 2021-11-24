import { FastifyPluginCallback } from 'fastify';
import { createChangesSchema } from './createUserSchema';
import { Server, Socket } from 'socket.io';
import { Observable, switchMap, tap } from 'rxjs';
import { pg } from '../../plugins/db';

type IRequestToServer = {};
type IResponseFromServer = {};

export interface ICreateChange<
  TableName extends string = string,
  Obj extends Record<string, any> & { id: string } = Record<string, any> & {
    id: string;
  }
> {
  id: string;
  type: DatabaseChangeType.Create;
  table: TableName;
  key: string;
  obj: Obj;
}

export interface IUpdateChange<
  TableName extends string = string,
  Obj extends Record<string, any> & { id: string } = Record<string, any> & {
    id: string;
  }
> {
  id: string;
  type: DatabaseChangeType.Update;
  table: TableName;
  key: string;
  from: Partial<Obj>;
  to: Partial<Obj>;
}

export interface IDeleteChange<
  TableName extends string = string,
  Obj extends Record<string, any> & { id: string } = Record<string, any> & {
    id: string;
  }
> {
  id: string;
  type: DatabaseChangeType.Delete;
  table: TableName;
  key: string;
}

export type IDatabaseChange<
  TableName extends string = string,
  Obj extends Record<string, any> & { id: string } = Record<string, any> & {
    id: string;
  }
> =
  | ICreateChange<TableName, Obj>
  | IUpdateChange<TableName, Obj>
  | IDeleteChange<TableName, Obj>;
export enum DatabaseChangeType {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
}

export enum CommandTypesFromClient {
  ApplyNewChanges = 'apply_new_changes',
  GetChanges = 'get_changes',
}

export type ApplyNewChangesFromClientCommand = {
  type: CommandTypesFromClient.ApplyNewChanges;

  request: ApplyNewChangesFromClientRequest;
  response: ApplyNewChangesFromClientResponse;
};

export interface ApplyNewChangesFromClientRequest {
  changes: IDatabaseChange[];
  partial: boolean;
  lastAppliedRemoteRevision: number | null;
}

export type ApplyNewChangesFromClientResponse =
  | {
      status: 'success';
      newRev: number;
    }
  | {
      status: 'stale_changes' | 'locked';
    };

export type GetChangesClientCommand = {
  type: CommandTypesFromClient.GetChanges;

  request: GetChangesRequest;
  response: GetChangesResponse;
};

export interface GetChangesRequest {
  fromServerTime: number;
  includeSelf: false;
}

export interface GetChangesResponse {
  changes: (IDatabaseChange & { clock: string })[];
  lastServerTime: number;
}

export type ClientCommands =
  | GetChangesClientCommand
  | ApplyNewChangesFromClientCommand;

export type ClientCommandRequests =
  | GetChangesRequest
  | ApplyNewChangesFromClientRequest;

export type ClientCommandResponses =
  | GetChangesResponse
  | ApplyNewChangesFromClientResponse;

function listenMessage<T extends ClientCommands>(type: T['type']) {
  return function (source: Observable<Socket>) {
    return source.pipe(
      switchMap((socket) => {
        return new Observable<[T['request'], (arg: T['response']) => void]>(
          (obs) => {
            socket.on(type as string, async (msg, callback) => {
              obs.next([msg, callback]);
            });
          }
        );
      })
    );
  };
}

export const syncHandler: FastifyPluginCallback = (server, options, next) => {
  const io = new Server(server.server);

  const socket$ = new Observable<Socket>((obs) => {
    const conn = io.on('connection', function (socket) {
      obs.next(socket);

      socket.on('disconnect', () => {
        obs.complete();
      });
    });
  });

  socket$
    .pipe(
      listenMessage<GetChangesClientCommand>(CommandTypesFromClient.GetChanges),
      tap(([resp, callback]) => {
        console.log({ resp });
        callback('hey!' as any);
      })
    )
    .subscribe(
      (s) => {
        console.log(s);
      },
      () => {
        console.log('error');
      },
      () => {
        console.log('unsub');
      }
    );

  server.get('/', async (req, res) => {
    await createChangesSchema(req.db, 'db_user3');

    res.send({ status: 'ok' });
  });

  next();
};
