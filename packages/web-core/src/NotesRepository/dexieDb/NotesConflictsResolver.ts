import { groupBy, uniq } from 'lodash-es';
import type { VaultDexieDatabase } from './DexieDb';

export class ConflictsResolver {
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
            (b) => b.id !== oldestRootBlock?.id,
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

          const linkedBlocks =
            await db.noteBlocksQueries.getLinkedBlocksOfNoteIds(
              notesWithoutOldestIds,
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
        }),
      );
    });
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
