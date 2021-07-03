import Dexie, { Table } from 'dexie';
import { uniq } from 'lodash-es';
import type { Patch } from 'mobx-keystone';
import { Subject } from 'rxjs';
import { buffer, debounceTime, concatMap, tap } from 'rxjs/operators';
import type {
  NoteBlockModel,
  NoteModel,
  VaultModel,
} from '../../NotesRepository';
import type { VaultDexieDatabase } from './DexieDb';
import type { NoteDocType, NoteBlockDocType } from '@harika/common';

// TODO: type rootKey
const zipPatches = (rootKey: string, patches: Patch[]) => {
  const scopedPatches = patches.filter((p) => p.path[0] === rootKey);

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

const mapNoteBlock = (model: NoteBlockModel): NoteBlockDocType => {
  return {
    id: model.$modelId,
    noteId: model.noteRef.id,
    content: model.content.value,
    createdAt: model.createdAt,
    noteBlockIds: model.noteBlockRefs.map(({ id }) => id),
    linkedNoteIds: model.linkedNoteRefs.map(({ id }) => id),
  };
};

const mapNote = (model: NoteModel): NoteDocType => {
  return {
    id: model.$modelId,
    dailyNoteDate: model.dailyNoteDate,
    title: model.title,
    createdAt: model.createdAt,
    rootBlockId: model.rootBlockRef.id,
  };
};

export class ToDexieSyncer {
  patchesSubject: Subject<Patch>;

  constructor(
    private database: VaultDexieDatabase,
    private vault: VaultModel,
    onPatchesApplied?: () => void,
  ) {
    this.patchesSubject = new Subject<Patch>();

    this.patchesSubject
      .pipe(
        buffer(this.patchesSubject.pipe(debounceTime(400))),
        concatMap((patches) => this.applyPatches(patches)),
        tap(() => onPatchesApplied?.()),
      )
      .subscribe();
  }

  handlePatch = (patches: Patch[]) => {
    patches.forEach((patch) => {
      this.patchesSubject.next(patch);
    });
  };

  private applier = <T extends object>(
    result: {
      toCreateIds: string[];
      toUpdateIds: string[];
      toDeleteIds: string[];
    },
    table: Table,
    mapper: (id: string) => T,
  ) => {
    return Promise.all([
      (async () => {
        if (result.toCreateIds.length > 0) {
          await table.bulkPut(result.toCreateIds.map(mapper));
        }
      })(),
      (async () => {
        if (result.toUpdateIds.length > 0) {
          await table.bulkPut(result.toUpdateIds.map(mapper));
        }
      })(),
      (async () => {
        if (result.toDeleteIds.length > 0) {
          await table.bulkDelete(result.toDeleteIds);
        }
      })(),
    ]);
  };

  private applyPatches = async (patches: Patch[]) => {
    patches = patches.filter(({ path }) =>
      ['blocksMap', 'notesMap'].includes(path[0] as string),
    );

    if (patches.length === 0) return;

    const blocksResult = zipPatches('blocksMap', patches);
    const noteResult = zipPatches('notesMap', patches);

    console.debug(
      'Applying patches from mobx',
      JSON.stringify({ blocksResult, noteResult }, null, 2),
    );

    this.database.transaction(
      'rw',
      this.database.notes,
      this.database.noteBlocks,
      async () => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        Dexie.currentTransaction.source = this.database.windowId;

        await Promise.all([
          this.applier(noteResult, this.database.notes, (id) =>
            mapNote(this.vault.notesMap[id]),
          ),
          this.applier(blocksResult, this.database.noteBlocks, (id) =>
            mapNoteBlock(this.vault.blocksMap[id]),
          ),
        ]);
      },
    );
  };
}
