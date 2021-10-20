import type { CommandsExecuter } from '../CommandsExecuter';
import {
  filter,
  from,
  map,
  merge,
  Observable,
  of,
  Subject,
  switchMap,
} from 'rxjs';
import { omit } from 'lodash-es';
import type { Remote } from 'comlink';
import type { ApplyNewChangesFromClientCommand } from '../types';
import { CommandTypesFromClient, DatabaseChangeType } from '../types';
import type { SyncRepository } from '../../../worker/repositories/SyncRepository';
import type { ApplyChangesService } from '../../../worker/services/ApplyChangesService';

export class ChangesApplierAndSender {
  constructor(
    private syncRepo: Remote<SyncRepository>,
    private applyChangesService: Remote<ApplyChangesService>,
    private commandExecuter: CommandsExecuter,
    private triggerGetChangesSubject: Subject<unknown>,
    private log: (str: string) => void,
    private onNewChange$: Observable<unknown>,
    private onNewPull$: Observable<unknown>,
  ) {}

  get$(): Observable<Observable<unknown>> {
    return merge(this.onNewChange$, of(null), this.onNewPull$).pipe(
      map(() => {
        return of(null).pipe(
          switchMap(() => this.applyServerChanges()),
          switchMap(() => this.sendChanges()),
        );
      }),
    );
  }

  private async applyServerChanges() {
    await this.applyChangesService.applyChanges();
  }

  private sendChanges = () => {
    return from(this.syncRepo.getClientChanges()).pipe(
      filter((clientChanges) => clientChanges.length > 0),
      switchMap(async (clientChanges) => ({
        clientChanges,
        syncStatus: await this.syncRepo.getSyncStatus(),
      })),
      switchMap(({ clientChanges, syncStatus }) =>
        this.commandExecuter
          .send<ApplyNewChangesFromClientCommand>(
            CommandTypesFromClient.ApplyNewChanges,
            {
              changes: clientChanges.map((change) => ({
                ...(change.type === DatabaseChangeType.Update
                  ? omit(change, 'obj')
                  : change),
                source: syncStatus.clientId,
              })),
              partial: false,
              lastAppliedRemoteRevision: syncStatus.lastAppliedRemoteRevision,
            },
          )
          .pipe(map((res) => ({ res, clientChanges }))),
      ),
      switchMap(({ res, clientChanges }) => {
        if (!res) return of(null);

        if (res.status === 'locked') {
          this.log('Locked. Just waiting for new changes');

          return of(null);
        }

        if (res.status === 'stale_changes') {
          // Maybe server has newer changes. Let's await for new server changes and try to send again
          this.triggerGetChangesSubject.next(null);

          return of(null);
        }

        return this.syncRepo.bulkDeleteClientChanges(
          clientChanges.map(({ id }) => id),
        );
      }),
    );
  };
}
