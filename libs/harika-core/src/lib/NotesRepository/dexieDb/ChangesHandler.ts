import Dexie from 'dexie';
import { uniq } from 'lodash-es';
import { Patch } from 'mobx-keystone';
import { Subject } from 'rxjs';
import { buffer, debounceTime, concatMap, tap } from 'rxjs/operators';
import { NoteBlockModel, NoteModel, VaultModel } from '../../NotesRepository';
import { NoteBlockDocType, NoteDocType, VaultDexieDatabase } from './DexieDb';

// TODO: type rootKey
const zipPatches = (rootKey: string, patches: Patch[]) => {
  const scopedPatches = patches.filter((p) => p.path[0] === rootKey);

  const toDeleteIds = uniq(
    scopedPatches
      .filter(
        (p) =>
          p.op === 'replace' && p.path[2] === 'isDeleted' && p.value === true
      )
      .map((p) => p.path[1] as string)
  );

  const toCreateIds = uniq(
    scopedPatches
      .filter(
        (p) =>
          p.op === 'add' &&
          p.path[0] === rootKey &&
          p.path.length === 2 &&
          !toDeleteIds.includes(p.path[1] as string)
      )
      .map((p) => p.path[1] as string)
  );

  const toDeleteAndCreateIds = [...toDeleteIds, ...toCreateIds];

  const toUpdateIds = uniq(
    scopedPatches
      .filter((p) => !toDeleteAndCreateIds.includes(p.path[1] as string))
      .map((p) => p.path[1] as string)
  );

  return {
    toCreateIds,
    toUpdateIds,
    toDeleteIds,
  };
};

const mapNoteBlock = (model: NoteBlockModel): NoteBlockDocType => {
  return {
    syncId: model.syncId,
    shortId: model.$modelId,
    noteId: model.noteRef.id,
    parentBlockId: model.parentBlockRef?.id,
    content: model.content.value,
    createdAt: model.createdAt.getTime(),
    noteBlockIds: model.noteBlockRefs.map(({ id }) => id),
    linkedNoteIds: model.linkedNoteRefs.map(({ id }) => id),
  };
};

const mapNote = (model: NoteModel): NoteDocType => {
  return {
    syncId: model.syncId,
    shortId: model.$modelId,
    dailyNoteDate: model.dailyNoteDate?.getTime(),
    title: model.title,
    createdAt: model.createdAt.getTime(),
    rootBlockId: model.rootBlockRef.id,
  };
};

export class ChangesHandler {
  patchesSubject: Subject<Patch>;

  constructor(
    private database: VaultDexieDatabase,
    private vault: VaultModel,
    onPatchesApplied?: () => void
  ) {
    this.patchesSubject = new Subject<Patch>();

    this.patchesSubject
      .pipe(
        buffer(this.patchesSubject.pipe(debounceTime(500))),
        concatMap((patches) => this.applyPatches(patches)),
        tap(() => onPatchesApplied?.())
      )
      .subscribe();
  }

  handlePatch = (patches: Patch[]) => {
    patches.forEach((patch) => {
      this.patchesSubject.next(patch);
    });
  };

  private applyPatches = async (patches: Patch[]) => {
    const blocksResult = zipPatches('blocksMap', patches);
    const noteResult = zipPatches('notesMap', patches);

    const applyForNoteBlocks = () =>
      Promise.all([
        (this.database.noteBlocks.bulkAdd(
          blocksResult.toCreateIds.map((id) => {
            return mapNoteBlock(this.vault.blocksMap[id]);
          })
        ) as unknown) as Promise<void>,
        this.database.noteBlocks.bulkPut(
          blocksResult.toUpdateIds.map((id) => {
            return mapNoteBlock(this.vault.blocksMap[id]);
          })
        ),
        (this.database.noteBlocks.bulkDelete(
          blocksResult.toDeleteIds
        ) as unknown) as Promise<void>,
      ]);

    const applyForNotes = () =>
      Promise.all([
        (this.database.notes.bulkAdd(
          noteResult.toCreateIds.map((id) => {
            return mapNote(this.vault.notesMap[id]);
          })
        ) as unknown) as Promise<void>,
        this.database.notes.bulkPut(
          noteResult.toUpdateIds.map((id) => {
            return mapNote(this.vault.notesMap[id]);
          })
        ),
        (this.database.notes.bulkDelete(
          noteResult.toDeleteIds
        ) as unknown) as Promise<void>,
      ]);

    this.database.transaction(
      'rw',
      this.database.notes,
      this.database.noteBlocks,
      () => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        Dexie.currentTransaction.source = this.database.windowId;
        return Promise.all([applyForNoteBlocks(), applyForNotes()]);
      }
    );
  };
}
