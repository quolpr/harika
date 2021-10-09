import type { Remote } from 'comlink';
import { defer, Observable } from 'rxjs';
import {
  buffer,
  concatMap,
  debounceTime,
  map,
  takeUntil,
} from 'rxjs/operators';
import type { BaseSyncRepository } from '../../../extensions/SyncExtension/persistence/BaseSyncRepository';
import {
  blockModelType,
  NoteBlockModel,
} from '../../../newApps/VaultApplication/NoteBlocksExtension/models/NoteBlockModel';
import type { BlocksScopesRepository } from '../../../newApps/VaultApplication/NoteBlocksExtension/repositories/BlockScopesRepository';
import type { NotesBlocksRepository } from '../../../newApps/VaultApplication/NoteBlocksExtension/repositories/NotesBlocksRepository';
import type { SqlNotesRepository } from '../NotesApp/repositories/NotesRepository';
import { mapNote } from '../NotesApp/converters/toDbDocs';
import { retryBackoff } from 'backoff-rxjs';
import {
  ISyncableModel,
  ISyncableModelChange,
  syncableModelChangesPipe$,
  SyncableModelChangeType,
} from '../../../extensions/SyncExtension/mobx-keystone/syncable';
import { NoteModel, noteModelType } from '../NotesApp/models/NoteModel';
import {
  BlocksScope,
  blocksScopeType,
} from '../../../newApps/VaultApplication/NoteBlocksExtension/models/BlocksScope';
import {
  mapBlocksScope,
  mapNoteBlock,
} from '../../../newApps/VaultApplication/NoteBlocksExtension/converters/toDbDocs';

export class ToDbSyncer {
  constructor(
    private notesRepository: Remote<SqlNotesRepository>,
    private notesBlocksRepository: Remote<NotesBlocksRepository>,
    private blocksScopesRepository: Remote<BlocksScopesRepository>,
    stop$: Observable<unknown>,
  ) {
    syncableModelChangesPipe$
      .pipe(
        buffer(syncableModelChangesPipe$.pipe(debounceTime(300))),
        map((changes) => changes.flat()),
        concatMap((changes) => {
          return defer(() => this.applyChanges(changes)).pipe(
            retryBackoff({
              initialInterval: 500,
              maxRetries: 5,
              resetOnSuccess: true,
            }),
          );
        }),
        takeUntil(stop$),
      )
      .subscribe({
        error: (e: unknown) => {
          console.error('Failed to save changes to db!');

          throw e;
        },
      });
  }

  private applyChanges = async (changes: ISyncableModelChange[]) => {
    if (changes.length === 0) return;

    const blocksChanges: ISyncableModelChange<NoteBlockModel>[] =
      changes.filter((ch) => {
        return ch.model.$modelType === blockModelType;
      });

    const notesChanges: ISyncableModelChange<NoteModel>[] = changes.filter(
      (ch) => {
        return ch.model.$modelType === noteModelType;
      },
    );

    const scopesChanges: ISyncableModelChange<BlocksScope>[] = changes.filter(
      (ch) => {
        return ch.model.$modelType === blocksScopeType;
      },
    );

    await this.apply(
      compressChanges(notesChanges),
      this.notesRepository,
      (model) => mapNote(model),
    );

    await this.apply(
      compressChanges(blocksChanges),
      this.notesBlocksRepository,
      (model) => mapNoteBlock(model),
    );

    await this.apply(
      compressChanges(scopesChanges),
      this.blocksScopesRepository,
      (model) => mapBlocksScope(model),
    );
  };

  private apply = <T>(
    result: {
      toCreateModels: ISyncableModel<T>[];
      toUpdateModels: ISyncableModel<T>[];
      toDeleteModels: ISyncableModel<T>[];
    },
    repo: Remote<BaseSyncRepository<any, any>>,
    mapper: (model: T) => unknown,
  ) => {
    const ctx = {
      shouldRecordChange: true,
      source: 'inDomainChanges' as const,
    };

    return Promise.all([
      result.toCreateModels.length > 0
        ? repo.bulkCreate(
            result.toCreateModels.map((model) => mapper(model)),
            ctx,
          )
        : null,
      result.toUpdateModels.length > 0
        ? repo.bulkUpdate(
            result.toUpdateModels.map((model) => mapper(model)),
            ctx,
          )
        : null,
      result.toDeleteModels.length > 0
        ? repo.bulkDelete(
            result.toDeleteModels.map(({ $modelId }) => $modelId),
            ctx,
          )
        : null,
    ]);
  };
}
