import type { Channel } from 'phoenix';
import { concatMap, map, merge, Observable, of, pipe, switchMap } from 'rxjs';
import type { CommandsExecuter } from '../CommandsExecuter';
import { v4 } from 'uuid';
import type { Remote } from 'comlink';
import type {ISyncStatus, SyncRepository} from "../../persistence/SyncRepository";
import type {GetChangesClientCommand, GetChangesResponse} from "../types";
import {CommandTypesFromClient} from "../types";

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
