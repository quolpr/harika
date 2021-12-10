import type { CommandsExecuter } from '../CommandsExecuter';
import { filter, from, map, merge, Observable, of, switchMap } from 'rxjs';
import { omit } from 'lodash-es';
import type { SyncRepository } from '../../repositories/SyncRepository';
import {
  ApplyNewChangesFromClientCommand,
  CommandTypesFromClient,
  DocChangeType,
} from '@harika/sync-common';
import { SyncStatusService } from '../../services/SyncStatusService';

export class ChangesSender {
  constructor(
    private syncRepo: SyncRepository,
    private syncStatusService: SyncStatusService,
    private commandExecuter: CommandsExecuter,
    private onNewChange$: Observable<unknown>,
  ) {}

  get$(): Observable<Observable<unknown>> {
    return merge(this.onNewChange$, of(null)).pipe(
      map(() => {
        return of(null).pipe(switchMap(() => this.sendChanges()));
      }),
    );
  }

  private sendChanges = () => {
    return from(this.syncRepo.getClientChanges()).pipe(
      filter((clientChanges) => clientChanges.length > 0),
      switchMap(async (clientChanges) => ({
        clientChanges,
        syncStatus: await this.syncStatusService.getSyncStatus(),
      })),
      switchMap(({ clientChanges, syncStatus }) =>
        this.commandExecuter
          .send<ApplyNewChangesFromClientCommand>(
            CommandTypesFromClient.ApplyNewChanges,
            {
              changes: clientChanges.map((change) => ({
                ...(change.type === DocChangeType.Update
                  ? omit(change, 'obj')
                  : change),
              })),
            },
          )
          .pipe(map((res) => ({ res, clientChanges }))),
      ),
      switchMap(({ res, clientChanges }) => {
        if (!res) return of(null);

        return this.syncRepo.bulkDeleteClientChanges(
          clientChanges.map(({ id }) => id),
        );
      }),
    );
  };
}
