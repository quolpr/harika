import type {
  ICreateChange,
  IDatabaseChange,
  NoteBlockDocType,
} from '@harika/common';
import type Dexie from 'dexie';
import { applyChanges } from '../../../dexie-sync/applyChanges';
import type { IConflictsResolver } from '../../../dexie-sync/ServerSynchronizer';
import { NoteblocksChangesConflictResolver } from './NoteblocksChangesConflictResolver';

export class ConflictsResolver implements IConflictsResolver {
  constructor(private db: Dexie) {}

  async resolveChanges(
    clientChanges: IDatabaseChange[],
    serverChanges: IDatabaseChange[],
  ) {
    const noteblocksResolver = new NoteblocksChangesConflictResolver();

    const noteBlocksFilter = ({ table }: { table: string }) =>
      table === 'noteBlocks';

    const notesFilter = ({ table }: { table: string }) => table === 'notes';

    const newChanges = noteblocksResolver.resolveConflicts(
      clientChanges.filter(noteBlocksFilter) as ICreateChange<
        'noteBlocks',
        NoteBlockDocType
      >[],
      serverChanges.filter(noteBlocksFilter) as ICreateChange<
        'noteBlocks',
        NoteBlockDocType
      >[],
    );

    const allChanges = [
      ...newChanges.changes,
      ...serverChanges.filter(notesFilter),
    ];

    console.log({ clientChanges, serverChanges, allChanges });

    await applyChanges(this.db, allChanges);
  }

  tables() {
    return [this.db.table('notes'), this.db.table('noteBlocks')];
  }
}
