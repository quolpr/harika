import { IDatabaseChange } from 'dexie-observable/api';
import {
  ApplyRemoteChangesFunction,
  ReactiveContinuation,
} from 'dexie-syncable/api';
import { fromEvent, Observable, of, Subject } from 'rxjs';
import {
  concatMap,
  filter,
  map,
  mergeMap,
  shareReplay,
  switchMap,
  take,
  tap,
} from 'rxjs/operators';
import { v4 } from 'uuid';

interface BaseCommand {
  commandId: string;
}

interface IApplyNewChangesFromClient extends BaseCommand {
  type: 'applyNewChangesFromClient';
  changes: IDatabaseChange[];
  partial: boolean;
  baseRevision: number;
}

interface ISubscribeClientToChanges extends BaseCommand {
  type: 'subscribeClientToChanges';
  syncedRevision: number;
}

interface IInitializeClient extends BaseCommand {
  type: 'initializeClient';
  identity: string;
  scopeId: string;
}

type IClientCommands =
  | IApplyNewChangesFromClient
  | ISubscribeClientToChanges
  | IInitializeClient;

interface IApplyNewChangesServerCommand extends BaseCommand {
  type: 'applyNewChanges';
  currentRevision: number;
  partial: boolean;
  changes: IDatabaseChange[];
}

type IServerCommands = IApplyNewChangesServerCommand;

const buildCommand = <T extends IClientCommands>(
  type: T['type'],
  data: Omit<T, 'requestId' | 'type'>
): T => {
  const requestId = v4();

  // TODO: fix
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return {
    ...data,
    type,
    commandId: requestId,
  };
};

export class RxSyncer {
  private socket$: Observable<SocketIOClient.Socket>;
  private connect$: Observable<SocketIOClient.Socket>;

  // TODO: store the queue of events
  private eventsBus$: Subject<IClientCommands> = new Subject();
  private disconnect$: Observable<SocketIOClient.Socket>;

  private responseBus$: Subject<{
    status: 'ok';
    requestId: string;
  }> = new Subject();

  private changesFromServer$: Observable<IApplyNewChangesServerCommand>;

  constructor(
    private socket: SocketIOClient.Socket,
    private scopeId: string,
    private identity: string
  ) {
    this.socket$ = of(socket);

    socket.on('connect', () => {
      console.log('connect!');
    });

    this.connect$ = this.socket$.pipe(
      switchMap((socket) =>
        fromEvent(socket, 'connect').pipe(map(() => socket))
      ),
      shareReplay(1)
    );

    this.connect$.subscribe(() => {
      console.log('connect rx!');
    });

    this.disconnect$ = this.connect$.pipe(
      mergeMap((socket) =>
        fromEvent(socket, 'disconnect').pipe(map(() => socket))
      ),
      shareReplay(1)
    );

    const onEvent = (event: string) => {
      return this.connect$.pipe(
        switchMap((socket) =>
          fromEvent<IApplyNewChangesServerCommand>(socket, event)
        )
      );
    };

    this.changesFromServer$ = onEvent('applyNewChanges');

    this.eventsBus$.subscribe((ev) => {
      console.log({ ev });
    });

    const onRequestHandled$ = onEvent('requestHandled');

    // Queue
    this.connect$
      .pipe(
        switchMap(() => {
          return this.eventsBus$.pipe(
            concatMap((evt) => {
              this.socket.emit(evt.type, evt);

              return onRequestHandled$.pipe(
                filter((response) => evt.data.requestId === response.requestId),
                take(1)
              );
            })
          );
        })
      )
      .subscribe((res) => {
        console.log({ res });
        this.responseBus$.next(res);
      });
  }

  initialize(
    // First time sync
    changes: IDatabaseChange[],
    baseRevision: number,
    partial: boolean,
    onChangesAccepted: () => void,

    syncedRevision: boolean,
    applyRemoteChanges: ApplyRemoteChangesFunction,
    onSuccess: (continuation: ReactiveContinuation) => void,
    onError: () => void
  ) {
    let isFirstRound = true;
    const isFirstSync = true;
    let wasFirstChangesSent = false;

    const sendFirstChanges = () => {
      if (wasFirstChangesSent) {
        return of(null);
      } else {
        return of(null).pipe(
          this.sendCommand(
            buildCommand('applyNewChanges', {
              changes: changes,
              partial: partial,
              baseRevision: baseRevision,
            })
          ),
          tap(() => {
            onChangesAccepted();
            wasFirstChangesSent = true;
          })
        );
      }
    };

    this.changesFromServer$.subscribe(
      ({
        currentRevision,
        partial,
        changes,
      }: {
        currentRevision: number;
        partial: boolean;
        changes: IDatabaseChange[];
      }) => {
        applyRemoteChanges(changes, currentRevision, partial);

        if (isFirstRound && !partial) {
          isFirstRound = false;

          onSuccess({
            react: async (
              changes,
              baseRevision,
              partial,
              onChangesAccepted
            ) => {
              // TODO: this.initializedAndConnected$
              this.connect$
                .pipe(
                  switchMap(() =>
                    of(null).pipe(
                      this.sendCommand('applyNewChanges', {
                        changes: changes,
                        partial: partial,
                        baseRevision: baseRevision,
                      })
                    )
                  )
                )
                .subscribe(() => {
                  onChangesAccepted();
                });
            },
            disconnect: () => {
              this.socket.close();
            },
          });
        }
      }
    );

    this.connect$.pipe(
      switchMap(() =>
        of(null).pipe(
          this.sendCommand(
            buildCommand('initialize', {
              identity: this.identity,
              scopeId: this.scopeId,
            })
          ),
          switchMap(sendFirstChanges),
          // TODO: what to do with synced revision?
          this.sendCommand(buildCommand('subscribeToChanges', {}))
        )
      )
    );
  }

  private sendCommand(command: IClientCommands) {
    return <T>(source: Observable<T>) => {
      const requestId = v4();

      this.eventsBus$.next(command);

      return source.pipe(
        switchMap(() =>
          this.responseBus$.pipe(
            filter((res) => res.requestId === requestId),
            take(1)
          )
        )
      );
    };
  }
}
