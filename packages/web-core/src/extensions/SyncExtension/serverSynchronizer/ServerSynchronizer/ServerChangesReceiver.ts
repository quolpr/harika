import { concatMap, map, merge, Observable, of, switchMap } from 'rxjs';
import type { CommandsExecuter } from '../CommandsExecuter';
import { v4 } from 'uuid';
import type { SyncRepository } from '../../repositories/SyncRepository';
import { Socket } from 'socket.io-client';
import {
  CommandTypesFromClient,
  EventsFromServer,
  GetSnapshotsClientCommand,
  GetSnapshotsResponse,
} from '@harika/sync-common';
import {
  ISyncStatus,
  SyncStatusService,
} from '../../services/SyncStatusService';

export interface IChangePullRow {
  id: string;
  changeIds: string[];
  serverRevision: number;
}

export class ServerSnapshotsReceiver {
  constructor(
    private syncRepo: SyncRepository,
    private syncStatusService: SyncStatusService,
    private commandExecuter: CommandsExecuter,
  ) {}

  get$(
    socket$: Observable<Socket | undefined>,
  ): Observable<Observable<unknown>> {
    const onNewRevEvent$ = socket$.pipe(
      switchMap((socket) => {
        return socket
          ? new Observable((observer) => {
              const listener = () => {
                observer.next();
              };

              socket.on(EventsFromServer.RevisionChanged, listener);

              return () =>
                socket.off(EventsFromServer.RevisionChanged, listener);
            })
          : of();
      }),
    );

    return merge(of(null), onNewRevEvent$).pipe(
      map(() => {
        return of(null).pipe(
          switchMap(() => this.syncStatusService.getSyncStatus()),
          switchMap((status) => this.getSnapshots(status)),
          concatMap(({ res }) => {
            if (!res || res?.status === 'error') {
              console.error('Failed to get changes');

              return of();
            }

            return this.storeReceivedSnapshots(res);
          }),
        );
      }),
    );
  }

  private getSnapshots = (syncStatus: ISyncStatus) => {
    return this.commandExecuter
      .send<GetSnapshotsClientCommand>(CommandTypesFromClient.GetSnapshots, {
        fromRev: syncStatus.lastReceivedRemoteRevision || 0,
      })
      .pipe(map((res) => ({ res, syncStatus })));
  };

  private storeReceivedSnapshots = async (res: GetSnapshotsResponse) => {
    if (res.currentRevision !== null && res.currentRevision !== undefined) {
      // if (res.lastTimestamp !== undefined) {
      //   this.syncStatusService.updateClock(res.lastTimestamp);
      // }

      await this.syncRepo.createSnapshots(res.currentRevision, res.snapshots);
    }
  };
}
