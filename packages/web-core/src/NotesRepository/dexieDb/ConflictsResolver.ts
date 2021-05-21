import { groupBy, uniq } from 'lodash-es';
import type { IConflictsResolver } from '../../dexieHelpers/RxSyncer';
import type { VaultDexieDatabase } from './DexieDb';

interface IConflict {
  name: string;
  ids: string[];
}

// We can't just pass sync to dexie sync protocol
export class ConflictsResolver implements IConflictsResolver<IConflict[]> {
  static dbs: Record<string, VaultDexieDatabase> = {};

  // Not a good idea, but there is not other good ways
  static addDb(id: string, db: VaultDexieDatabase) {
    this.dbs[id] = db;
  }

  async checkConflicts(dbId: string) {
    const keys = await ConflictsResolver.dbs[dbId].notes
      .orderBy('[title+id]')
      .keys();

    const conflicts = (
      Object.entries(
        groupBy(Array.from(keys), ([title]: [string]) => title),
      ) as unknown as [string, [string, string][]][]
    )
      .filter(([, v]) => v.length > 1)
      .map(([name, objects]: [string, [string, string][]]) => ({
        name,
        ids: objects.map(([, id]) => id),
      }));

    console.log('checkConflicts', conflicts);

    if (conflicts.length === 0) {
      return false;
    } else {
      return conflicts;
    }
  }

  // TODO: could be optimized to bulkAdd/bulkDelete/bulkUpdate
  async resolveConflicts(dbId: string, conflicts: IConflict[]) {
    const db = ConflictsResolver.dbs[dbId];

    console.log('Resolving conflicts', conflicts);

    await Promise.all(
      conflicts.map(async (conflict) => {
        const notes = (await db.notesQueries.getByIds(conflict.ids)).sort(
          (a, b) => a.createdAt - b.createdAt,
        );

        const oldestNote = notes[0];
        const notesWithoutOldest = notes.slice(1);
        const notesWithoutOldestIds = notesWithoutOldest.map(({ id }) => id);

        // 1. merge root blocks

        const rootBlocks = await db.noteBlocksQueries.getByIds(
          notes.map(({ rootBlockId }) => rootBlockId),
        );

        const oldestRootBlock = rootBlocks.find(
          ({ id }) => id === oldestNote.rootBlockId,
        );

        const nonOldestRootBlocks = rootBlocks.filter(
          (b) => b.id != oldestRootBlock?.id,
        );

        if (!oldestRootBlock)
          throw new Error('Unexpected error - root block not found');

        rootBlocks.forEach((noteBlock) => {
          if (noteBlock.id === oldestRootBlock.id) return;

          oldestRootBlock.noteBlockIds = [
            ...oldestRootBlock.noteBlockIds,
            ...noteBlock.noteBlockIds,
          ];
        });

        const noteBlocksExceptOldest = await db.noteBlocksQueries.getByNoteIds(
          notesWithoutOldest.map(({ id }) => id),
        );

        const linkedBlocks =
          await db.noteBlocksQueries.getLinkedBlocksOfNoteIds(
            notesWithoutOldestIds,
          );

        await db.transaction('rw', [db.notes, db.noteBlocks], async () => {
          // updating to correct parentBlockId and note id
          await Promise.all(
            // could be done with bulPut or bulkUpdate when released
            noteBlocksExceptOldest.map(async (block) => {
              await db.noteBlocks.update(block.id, {
                ...block,
                noteId: oldestNote.id,
                parentBlockId:
                  block.parentBlockId &&
                  nonOldestRootBlocks
                    .map(({ id }) => id)
                    .includes(block.parentBlockId)
                    ? oldestRootBlock.id
                    : block.parentBlockId,
              });
            }),
          );

          // updating all old note refs from other noteBlocks
          await Promise.all(
            linkedBlocks.map(async (block) => {
              await db.noteBlocks.update(block.id, {
                ...block,
                linkedNoteIds: uniq(
                  block.linkedNoteIds.map((id) =>
                    notesWithoutOldestIds.includes(id) ? oldestNote.id : id,
                  ),
                ),
              });
            }),
          );

          await db.noteBlocks.update(oldestRootBlock.id, oldestRootBlock);
          await db.noteBlocks.bulkDelete(
            nonOldestRootBlocks.map(({ id }) => id),
          );
          await db.notes.bulkDelete(notesWithoutOldestIds);
        });
      }),
    );
  }
}
