import type { Channel } from 'phoenix';
import { concatMap, map, merge, Observable, of, pipe, switchMap } from 'rxjs';
import type { CommandsExecuter } from '../CommandsExecuter';
import { v4 } from 'uuid';
import type {
  ISyncStatus,
  SyncRepository,
} from '../../repositories/SyncRepository';
import type { GetChangesClientCommand, GetChangesResponse } from '../types';
import { CommandTypesFromClient } from '../types';

export interface IChangePullRow {
  id: string;
  changeIds: string[];
  serverRevision: number;
}

export class ServerChangesReceiver {
  constructor(
    private syncRepo: SyncRepository,
    private commandExecuter: CommandsExecuter,
  ) {}

  get$(
    channel$: Observable<Channel | undefined>,
    getChange$: Observable<unknown>,
  ): Observable<Observable<unknown>> {
    const onNewChangeEvent$ = channel$.pipe(
      switchMap((channel) => {
        return channel
          ? new Observable((observer) => {
              const ref = channel.on('revision_was_changed', () => {
                observer.next();
              });

              return () => channel.off('revision_was_changed', ref);
            })
          : of();
      }),
    );

    return merge(of(null), onNewChangeEvent$, getChange$).pipe(
      map(() => {
        return of(null).pipe(
          switchMap(() => this.syncRepo.getSyncStatus()),
          switchMap((status) => this.getChanges(status)),
          concatMap(({ res }) => {
            if (res === null) {
              console.error('Failed to get changes');

              return of();
            }

            return this.storeReceivedChanges(res);
          }),
        );
      }),
    );
  }

  private getChanges = (syncStatus: ISyncStatus) => {
    return this.commandExecuter
      .send<GetChangesClientCommand>(CommandTypesFromClient.GetChanges, {
        fromRevision: syncStatus.lastReceivedRemoteRevision,
        includeSelf: false,
      })
      .pipe(map((res) => ({ res, syncStatus })));
  };

  private storeReceivedChanges = async (res: GetChangesResponse) => {
    const pullId = v4();

    if (res.currentRevision !== null) {
      await this.syncRepo.createPull(
        {
          id: pullId,
          serverRevision: res.currentRevision,
        },
        res.changes.map((ch) => ({ ...ch, pullId })),
      );
    }
  };
}
