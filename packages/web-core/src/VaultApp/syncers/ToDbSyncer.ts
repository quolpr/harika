import type { Remote } from 'comlink';
import { defer, Observable } from 'rxjs';
import {
  buffer,
  concatMap,
  debounceTime,
  map,
  takeUntil,
} from 'rxjs/operators';
import type { BaseSyncRepository } from '../../db/sync/persistence/BaseSyncRepository';
import {
  blockModelType,
  NoteBlockModel,
} from '../NoteBlock/models/NoteBlockModel';
import type { BlocksScopesRepository } from '../NoteBlock/repositories/BlockScopesRepository';
import type { SqlNotesBlocksRepository } from '../NoteBlock/repositories/NotesBlocksRepository';
import type { SqlNotesRepository } from '../Note/repositories/NotesRepository';
import {
  mapNote,

} from '../Note/converters/toDbDocs';
import { retryBackoff } from 'backoff-rxjs';
import {
  ISyncableModel,
  ISyncableModelChange,
  syncableModelChangesPipe$,
  SyncableModelChangeType,
} from '../utils/syncable';
import { NoteModel, noteModelType } from '../Note/models/NoteModel';
import {
  BlocksScope,
  blocksScopeType,
} from '../NoteBlock/views/BlocksScope';
import {mapBlocksScope, mapNoteBlock} from "../NoteBlock/converters/toDbDocs";

const compressChanges = <T>(chs: ISyncableModelChange<T>[]) => {
  const modelsMap: Record<string, T> = {};
  const toCreateModels = new Set<T>();
  const toUpdateModels = new Set<T>();
  const toDeleteModels = new Set<T>();

  chs.forEach((ch) => {
    modelsMap[ch.model.$modelId] = ch.model;

    if (ch.type === SyncableModelChangeType.Create) {
      if (toUpdateModels.has(ch.model)) {
        toUpdateModels.delete(ch.model);
      }
      if (toDeleteModels.has(ch.model)) {
        throw new Error("Can't create deleted model");
      }

      toCreateModels.add(ch.model);
    } else if (ch.type === SyncableModelChangeType.Update) {
      if (toCreateModels.has(ch.model)) return;
      if (toDeleteModels.has(ch.model)) return;

      toUpdateModels.add(ch.model);
    } else {
      if (toCreateModels.has(ch.model)) {
        toCreateModels.delete(ch.model);
      }
      if (toUpdateModels.has(ch.model)) {
        toUpdateModels.delete(ch.model);
      }

      toDeleteModels.add(ch.model);
    }
  });

  return {
    toCreateModels: Array.from(toCreateModels),
    toUpdateModels: Array.from(toUpdateModels),
    toDeleteModels: Array.from(toDeleteModels),
  };
};

export class ToDbSyncer {
  constructor(
    private notesRepository: Remote<SqlNotesRepository>,
    private notesBlocksRepository: Remote<SqlNotesBlocksRepository>,
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
