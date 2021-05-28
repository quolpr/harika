import { difference, groupBy, uniq } from 'lodash-es';
import type { IConflictsResolver } from '../../dexieHelpers/RxSyncer';
import type { VaultDexieDatabase } from './DexieDb';

export class ConflictsResolver implements IConflictsResolver {
  constructor(private db: VaultDexieDatabase) {}

  // TODO: could be optimized to bulkAdd/bulkDelete/bulkUpdate
  async resolveConflicts(
    entitiesToCheck: Array<{ table: string; key: string }>,
  ) {
    const db = this.db;

    const conflicts = await this.getConflicts();

    if (conflicts.length === 0 && entitiesToCheck.length === 0) {
      console.debug('No conflicts');
      return;
    }

    const blockIdsToCheck = uniq(
      entitiesToCheck
        .filter(({ table }) => table === 'noteBlocks')
        .map(({ key }) => key),
    );

    console.debug(
      'Resolving conflicts',
      JSON.stringify({
        changedBlockIds: blockIdsToCheck,
        conflicts,
      }),
    );

    await db.transaction('rw', [db.notes, db.noteBlocks], async () => {
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

          const noteBlocksExceptOldest =
            await db.noteBlocksQueries.getByNoteIds(
              notesWithoutOldest.map(({ id }) => id),
            );

          const linkedBlocks =
            await db.noteBlocksQueries.getLinkedBlocksOfNoteIds(
              notesWithoutOldestIds,
            );

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

          await this.resolveHiddenNoteBlock(blockIdsToCheck);
        }),
      );
    });
  }

  // Hidden noteblicks could be when noteBlock.noteBlockIds have not all
  // noteblocks cause of merge conflict resolving
  private async resolveHiddenNoteBlock(ids: string[]) {
    const noteBlocks = await this.db.noteBlocksQueries.getByIds(ids);

    const noteBlocksByParents = await this.db.noteBlocksQueries.getByParentIds(
      noteBlocks.map(({ id }) => id),
    );

    await Promise.all(
      noteBlocks.map(async (noteBlock) => {
        const childrenByParentIds = noteBlocksByParents
          .filter((b) => b.parentBlockId === noteBlock.id)
          .map(({ id }) => id);

        const missedIds = difference(
          childrenByParentIds,
          noteBlock.noteBlockIds,
        );

        noteBlock.noteBlockIds = [...noteBlock.noteBlockIds, ...missedIds];

        await this.db.noteBlocks.update(noteBlock.id, noteBlock);
      }),
    );
  }

  private async getConflicts() {
    const keys = await this.db.notes.orderBy('[title+id]').keys();

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

    return conflicts;
  }
}
