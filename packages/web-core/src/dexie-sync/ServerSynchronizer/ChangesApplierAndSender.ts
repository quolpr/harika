import {
  ApplyNewChangesFromClientCommand,
  CommandTypesFromClient,
  DatabaseChangeType,
} from '../../dexieTypes';
import type { CommandsExecuter } from '../CommandsExecuter';
import { filter, from, map, of, pipe, Subject, switchMap } from 'rxjs';
import { omit } from 'lodash-es';
import type { Remote } from 'comlink';
import type {
  ApplyChangesService,
  SyncRepository,
} from '../../SqlNotesRepository.worker';

export class ChangesApplierAndSender {
  constructor(
    private syncRepo: Remote<SyncRepository>,
    private applyChangesService: Remote<ApplyChangesService>,
    private commandExecuter: CommandsExecuter,
    private triggerGetChangesSubject: Subject<unknown>,
    private log: (str: string) => void,
  ) {}

  emitter() {
    return of(null);
  }

  pipe() {
    return pipe(
      switchMap(() => this.applyServerChanges()),
      switchMap(() => this.sendChanges()),
    );
  }

  private async applyServerChanges() {
    await this.applyChangesService.applyChanges();
  }

  private sendChanges = () => {
    return from(this.syncRepo.getChangesToSend()).pipe(
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

        return this.syncRepo.bulkDeleteChangesToSend(
          clientChanges.map(({ id }) => id),
        );
      }),
    );
  };
}
