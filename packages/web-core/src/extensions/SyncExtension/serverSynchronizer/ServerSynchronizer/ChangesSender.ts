import {
  ApplyNewChangesFromClientCommand,
  CommandTypesFromClient,
  DocChangeType,
} from '@harika/sync-common';
import { omit } from 'lodash-es';
import {
  filter,
  from,
  map,
  merge,
  Observable,
  of,
  Subject,
  switchMap,
  tap,
} from 'rxjs';

import type { SyncRepository } from '../../repositories/SyncRepository';
import { SyncStatusService } from '../../services/SyncStatusService';
import type { CommandsExecuter } from '../CommandsExecuter';

export class ChangesSender {
  private triggerNext$ = new Subject<void>();

  constructor(
    private syncRepo: SyncRepository,
    private syncStatusService: SyncStatusService,
    private commandExecuter: CommandsExecuter,
    private onNewChange$: Observable<unknown>,
  ) {}

  get$(): Observable<Observable<unknown>> {
    return merge(this.onNewChange$, of(null), this.triggerNext$).pipe(
      map(() => {
        return of(null).pipe(switchMap(() => this.sendChanges()));
      }),
    );
  }

  private sendChanges = () => {
    return from(this.syncRepo.getClientChanges()).pipe(
      filter(({ changes }) => changes.length > 0),
      switchMap(async ({ changes, areMore }) => {
        return {
          clientChanges: changes,
          areMore,
          syncStatus: await this.syncStatusService.getSyncStatus(),
        };
      }),
      switchMap(({ clientChanges, syncStatus, areMore }) =>
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
          .pipe(map((res) => ({ res, clientChanges, areMore }))),
      ),
      switchMap(async ({ res, clientChanges, areMore }) => {
        if (!res) return { areMore };

        await this.syncRepo.bulkDeleteClientChanges(
          clientChanges.map(({ id }) => id),
        );

        return { areMore };
      }),
      tap(({ areMore }) => {
        if (areMore) {
          this.triggerNext$.next();
        }
      }),
    );
  };
}
