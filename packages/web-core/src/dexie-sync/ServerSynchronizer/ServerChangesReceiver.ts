import type { Channel } from 'phoenix';
import { concatMap, map, merge, Observable, of, pipe, switchMap } from 'rxjs';
import {
  CommandTypesFromClient,
  GetChangesClientCommand,
  GetChangesResponse,
} from '../../dexieTypes';
import type { CommandsExecuter } from '../CommandsExecuter';
import type { ISyncStatus } from '../SyncStatusService';
import { v4 } from 'uuid';
import type { SyncRepository } from '../../SqlNotesRepository.worker';
import type { Remote } from 'comlink';

export interface IChangePullRow {
  id: string;
  changeIds: string[];
  serverRevision: number;
}

export class ServerChangesReceiver {
  constructor(
    private syncRepo: Remote<SyncRepository>,
    private commandExecuter: CommandsExecuter,
  ) {}

  emitter(channel$: Observable<Channel>, getChange$: Observable<unknown>) {
    return merge(
      of(null),
      channel$.pipe(
        switchMap((channel) => {
          return new Observable((observer) => {
            const ref = channel.on('revision_was_changed', () => {
              observer.next();
            });

            return () => channel.off('revision_was_changed', ref);
          });
        }),
      ),
      getChange$,
    );
  }

  pipe() {
    return pipe(
      switchMap(() => this.syncRepo.getSyncStatus()),
      switchMap((status) =>
        this.commandExecuter
          .send<GetChangesClientCommand>(CommandTypesFromClient.GetChanges, {
            fromRevision: status.lastReceivedRemoteRevision,
            includeSelf: false,
          })
          .pipe(map((res) => ({ res, syncStatus: status }))),
      ),
      concatMap(({ res, syncStatus }) => {
        if (res === null) {
          console.error('Failed to get changes');

          return of();
        }

        return this.storeReceivedChanges(res, syncStatus);
      }),
    );
  }

  private storeReceivedChanges = async (
    res: GetChangesResponse,
    syncStatus: ISyncStatus,
  ) => {
    const pullId = v4();

    await this.syncRepo.insertChangesFromServer(
      {
        id: pullId,
        serverRevision: res.currentRevision,
      },
      res.changes.map((ch) => ({ ...ch, pullId })),
    );
  };
}
