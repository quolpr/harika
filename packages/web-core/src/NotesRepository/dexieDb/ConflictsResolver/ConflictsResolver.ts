import type {
  ICreateChange,
  IDatabaseChange,
  NoteBlockDocType,
} from '@harika/common';
import { applyChanges } from '../../../dexie-sync/applyChanges';
import type { IConflictsResolver } from '../../../dexie-sync/ServerSynchronizer';
import { ConsistencyResolver } from '../ConsistencyResolver/ConsistencyResolver';
import type { VaultDexieDatabase } from '../DexieDb';
import { NoteblocksChangesConflictResolver } from './NoteblocksChangesConflictResolver';

export class ConflictsResolver implements IConflictsResolver {
  private consistencyResolver: ConsistencyResolver;

  constructor(private db: VaultDexieDatabase) {
    this.consistencyResolver = new ConsistencyResolver(db);
  }

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

    await applyChanges(this.db, allChanges);

    await this.consistencyResolver.resolve(allChanges);
  }

  tables() {
    return [this.db.table('notes'), this.db.table('noteBlocks')];
  }
}
