import { groupBy, uniq } from 'lodash-es';
import type { IConsistencyResolver } from '../../../dexie-sync/ServerSynchronizer';
import type { NoteBlockDocType, NoteDocType } from '../../../dexieTypes';
import type { VaultDexieDatabase } from '../DexieDb';

export class VaultDbConsistencyResolver implements IConsistencyResolver {
  constructor(private db: VaultDexieDatabase) {}

  async resolve() {
    await this.resolveNoteDuplications();
  }

  async resolveNoteDuplications() {
    const conflicts = await this.getNotesConflicts();

    await Promise.all(
      conflicts.map(async (conflict) => {
        const notes = (await this.db.notesQueries.getByIds(conflict.ids)).sort(
          (a, b) => a.createdAt - b.createdAt,
        );

        const oldestNote = notes[0];
        const notesWithoutOldest = notes.slice(1);
        const notesWithoutOldestIds = notesWithoutOldest.map(({ id }) => id);

        // 1. merge root blocks

        const rootBlocks = (
          await Promise.all(
            notes.map(async (note) => ({
              note,
              rootBlock: await this.db.noteBlocksQueries.getRootBlock(note.id),
            })),
          )
        ).filter(({ rootBlock }) => Boolean(rootBlock)) as {
          note: NoteDocType;
          rootBlock: NoteBlockDocType;
        }[];

        const oldestRootBlock = rootBlocks.find(
          ({ note }) => note.id === oldestNote.id,
        )?.rootBlock;

        const nonOldestRootBlocks = rootBlocks
          .filter(({ rootBlock }) => rootBlock?.id !== oldestRootBlock?.id)
          .map(({ rootBlock }) => rootBlock);

        if (!oldestRootBlock) {
          console.error(
            'Unexpected error - root block not found',
            rootBlocks,
            notes,
          );
          return;
        }

        rootBlocks.forEach(({ rootBlock }) => {
          if (rootBlock.id === oldestRootBlock.id) return;

          oldestRootBlock.noteBlockIds = [
            ...oldestRootBlock.noteBlockIds,
            ...rootBlock.noteBlockIds,
          ];
        });

        const linkedBlocks =
          await this.db.noteBlocksQueries.getLinkedBlocksOfNoteIds(
            notesWithoutOldestIds,
          );

        // updating all old note refs from other noteBlocks
        await Promise.all(
          linkedBlocks.map(async (block) => {
            await this.db.noteBlocks.update(block.id, {
              ...block,
              linkedNoteIds: uniq(
                block.linkedNoteIds.map((id) =>
                  notesWithoutOldestIds.includes(id) ? oldestNote.id : id,
                ),
              ),
            });
          }),
        );

        // Fixing noteId of all moved blocks
        const blocksToFix = await this.db.noteBlocksQueries.getByNoteIds(
          notesWithoutOldestIds,
        );
        await Promise.all(
          blocksToFix.map(async (block) => {
            this.db.noteBlocks.put({ ...block, noteId: oldestNote.id });
          }),
        );

        await this.db.noteBlocks.put(oldestRootBlock);
        await this.db.noteBlocks.bulkDelete(
          nonOldestRootBlocks.map(({ id }) => id),
        );
        await this.db.notes.bulkDelete(notesWithoutOldestIds);
      }),
    );
  }

  async getNotesConflicts() {
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
