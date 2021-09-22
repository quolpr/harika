import type { Remote } from 'comlink';
import { uniq } from 'lodash-es';
import type { Patch, Path } from 'mobx-keystone';
import { BehaviorSubject, defer } from 'rxjs';
import { buffer, concatMap, debounceTime, map } from 'rxjs/operators';
import type { BaseSyncRepository } from '../../db-sync/persistence/BaseSyncRepository';
import type { NoteBlockModel } from '../domain/NoteBlocksApp/models/NoteBlockModel';
import type { Vault } from '../NotesService';
import type { BlocksScopesRepository } from '../persistence/BlockScopesRepository';
import type { SqlNotesBlocksRepository } from '../persistence/NotesBlocksRepository';
import type { SqlNotesRepository } from '../persistence/NotesRepository';
import {
  mapBlocksScope,
  mapNote,
  mapNoteBlock,
} from '../converters/toDbDocsConverters';
import { retryBackoff } from 'backoff-rxjs';

// TODO: type rootKey
const zipPatches = (selector: (path: Path) => boolean, patches: Patch[]) => {
  const scopedPatches = patches.filter((p) => selector(p.path));

  const toDeleteIds = uniq(
    scopedPatches
      .filter(
        (p) =>
          p.op === 'replace' && p.path[2] === 'isDeleted' && p.value === true,
      )
      .map((p) => p.path[1] as string),
  );

  const toCreateIds = uniq(
    scopedPatches
      .flatMap((p) => {
        if (p.op === 'add' && p.path.length === 2) {
          return p.path[1] as string;
        } else if (
          p.op === 'replace' &&
          p.path.length === 1 &&
          typeof p.value === 'object'
        ) {
          return Object.keys(p.value) as string[];
        } else {
          return undefined;
        }
      })
      .filter((key) => key !== undefined && !toDeleteIds.includes(key)),
  ) as string[];

  const toDeleteAndCreateIds = [...toDeleteIds, ...toCreateIds];

  const toUpdateIds = uniq(
    scopedPatches
      .filter(
        (p) =>
          p.path[1] !== undefined &&
          !toDeleteAndCreateIds.includes(p.path[1] as string),
      )
      .map((p) => p.path[1] as string),
  );

  return {
    toCreateIds,
    toUpdateIds,
    toDeleteIds,
  };
};

const getBlocksPatches = (
  getNoteBlock: (id: string) => NoteBlockModel | undefined,
  patches: Patch[],
) => {
  const toCreateIds = new Set<string>();
  const toUpdateIds = new Set<string>();
  const toDeleteIds = new Set<string>();

  patches.forEach((patch) => {
    if (patch.path.length === 3 && patch.op === 'add') {
      Object.keys(patch.value.blocksMap).forEach((v) => {
        toCreateIds.add(v);
      });
    } else if (patch.path.length >= 5) {
      const id = patch.path[4] as string;

      if (patch.op === 'add' && patch.path.length === 5) {
        toCreateIds.add(id);
      } else {
        const noteBlock = getNoteBlock(id);

        if (!noteBlock || noteBlock.isDeleted) {
          toDeleteIds.add(id);
        } else {
          toUpdateIds.add(id);
        }
      }
    } else {
      console.error(patch, 'Unknown patch');
    }
  });

  return {
    toCreateIds: Array.from(toCreateIds).filter((id) => !toDeleteIds.has(id)),
    toUpdateIds: Array.from(toUpdateIds).filter(
      (id) => !toCreateIds.has(id) && !toDeleteIds.has(id),
    ),
    toDeleteIds: Array.from(toDeleteIds),
  };
};

export class ToDbSyncer {
  private onwNewPatch: BehaviorSubject<true> = new BehaviorSubject(true);
  private currentPatches: Patch[] = [];

  constructor(
    private notesRepository: Remote<SqlNotesRepository>,
    private notesBlocksRepository: Remote<SqlNotesBlocksRepository>,
    private blocksScopesRepository: Remote<BlocksScopesRepository>,
    private vault: Vault,
  ) {
    this.onwNewPatch
      .pipe(
        buffer(this.onwNewPatch.pipe(debounceTime(400))),
        map(() => [...this.currentPatches]),
        concatMap((patches) => {
          return defer(() => this.applyPatches(patches)).pipe(
            retryBackoff({
              initialInterval: 500,
              maxRetries: 5,
              // 👇 resets retries count and delays between them to init values
              resetOnSuccess: true,
            }),
          );
        }),
      )
      .subscribe({
        error: (e: unknown) => {
          console.error('Failed to save changes to db!');

          throw e;
        },
      });
  }

  handlePatch = (patches: Patch[]) => {
    this.currentPatches.push(...patches);
    this.onwNewPatch.next(true);
  };

  private applyPatches = async (allPatches: Patch[]) => {
    const blocksPatches = allPatches.filter(
      ({ path }) =>
        path[0] === 'noteBlocksApp' && path[1] === 'blocksRegistries',
    );
    const notesPatches = allPatches.filter(
      ({ path }) => path[0] === 'notesMap',
    );
    const scopesPatches = allPatches.filter(
      ({ path }) => path[0] === 'noteBlocksApp' && path[1] === 'blocksScopes',
    );

    if (
      blocksPatches.length === 0 &&
      notesPatches.length === 0 &&
      scopesPatches.length === 0
    )
      return;

    console.log('patches to handle', {
      blocksPatches,
      notesPatches,
      scopesPatches,
    });

    const blocksResult = getBlocksPatches(
      (id) => this.vault.getNoteBlock(id),
      blocksPatches,
    );

    const noteResult = zipPatches((p) => p[0] === 'notesMap', notesPatches);

    const scopeToUpdateIds = scopesPatches
      .map((p) =>
        p.path.length > 4 && p.path[3] === 'collapsedBlockIds'
          ? p.path[2]
          : undefined,
      )
      .filter((id) => id !== undefined) as string[];

    console.debug(
      'Applying patches from mobx',
      JSON.stringify({ blocksResult, noteResult }, null, 2),
    );

    await this.applier(noteResult, this.notesRepository, (id) =>
      mapNote(this.vault.notesMap[id]),
    );

    await this.applier(blocksResult, this.notesBlocksRepository, (id) =>
      mapNoteBlock(this.vault.getNoteBlock(id)!),
    );

    await this.blocksScopesRepository.bulkCreateOrUpdate(
      scopeToUpdateIds.map((id) =>
        mapBlocksScope(this.vault.noteBlocksApp.getScopeById(id)),
      ),
      {
        shouldRecordChange: true,
        source: 'inDomainChanges' as const,
      },
    );
  };

  private applier = <T extends Record<string, unknown> & { id: string }>(
    result: {
      toCreateIds: string[];
      toUpdateIds: string[];
      toDeleteIds: string[];
    },
    repo: Remote<BaseSyncRepository<T, any>>,
    mapper: (id: string) => T,
  ) => {
    const ctx = {
      shouldRecordChange: true,
      source: 'inDomainChanges' as const,
    };

    return Promise.all([
      result.toCreateIds.length > 0
        ? repo.bulkCreate(
            result.toCreateIds.map((id) => mapper(id)),
            ctx,
          )
        : null,
      result.toUpdateIds.length > 0
        ? repo.bulkUpdate(
            result.toUpdateIds.map((id) => mapper(id)),
            ctx,
          )
        : null,
      result.toDeleteIds.length > 0
        ? repo.bulkDelete(result.toDeleteIds, ctx)
        : null,
    ]);
  };
}
