import { uniq } from 'lodash-es';
import { Patch } from 'mobx-keystone';
import { Subject } from 'rxjs';
import { buffer, concatMap, debounceTime, tap } from 'rxjs/operators';
import { Vault } from '../../NoteRepository';
import { NoteBlockModel } from '../models/NoteBlockModel';
import { NoteModel } from '../models/NoteModel';
import { VaultRxDatabase } from './initDb';

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

const mapNoteBlock = (model: NoteBlockModel) => {
  return {
    _id: model.$modelId,
    noteRef: model.noteRef.id,
    parentBlockRef: model.parentBlockRef?.id,
    content: model.content,
    createdAt: model.createdAt.getTime(),
    noteBlockRefs: model.noteBlockRefs.map(({ id }) => id),
    linkedNoteRefs: model.linkedNoteRefs.map(({ id }) => id),
  };
};

const mapNote = (model: NoteModel) => {
  console.log({ model });
  return {
    _id: model.$modelId,
    dailyNoteDate: model.dailyNoteDate?.getTime(),
    title: model.title,
    createdAt: model.createdAt.getTime(),
    rootBlockRef: model.rootBlockRef.id,
  };
};

export class RxdbChangesHandler {
  patchesSubject: Subject<Patch>;

  constructor(
    private database: VaultRxDatabase,
    private vault: Vault,
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

    console.log({ blocksResult, noteResult });

    const applyForNoteBlocks = () =>
      Promise.all([
        (this.database.noteblocks.bulkInsert(
          blocksResult.toCreateIds.map((id) => {
            return mapNoteBlock(this.vault.blocksMap[id]);
          })
        ) as unknown) as Promise<void>,
        ...blocksResult.toUpdateIds.map(async (id) => {
          await this.database.noteblocks.upsert(
            mapNoteBlock(this.vault.blocksMap[id])
          );
        }),
        (this.database.noteblocks.bulkRemove(
          blocksResult.toDeleteIds
        ) as unknown) as Promise<void>,
      ]);

    const applyForNotes = () =>
      Promise.all([
        (this.database.notes.bulkInsert(
          noteResult.toCreateIds.map((id) => {
            return mapNote(this.vault.notesMap[id]);
          })
        ) as unknown) as Promise<void>,
        ...noteResult.toUpdateIds.map(async (id) => {
          await this.database.notes.upsert(mapNote(this.vault.notesMap[id]));
        }),
        (this.database.notes.bulkRemove(
          noteResult.toDeleteIds
        ) as unknown) as Promise<void>,
      ]);

    await Promise.all([applyForNoteBlocks(), applyForNotes()]);
  };
}
