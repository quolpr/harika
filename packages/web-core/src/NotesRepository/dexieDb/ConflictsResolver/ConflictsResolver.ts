import { Dexie } from 'dexie';
import type {
  IDatabaseChange,
  INoteBlockChangeEvent,
  INoteChangeEvent,
} from '../../../dexieTypes';
import { applyChanges } from '../../../dexie-sync/applyChanges';
import type { IConflictsResolver } from '../../../dexie-sync/ServerSynchronizer';
import { ConsistencyResolver } from '../ConsistencyResolver/ConsistencyResolver';
import type { VaultDexieDatabase } from '../DexieDb';
import { NoteblocksChangesConflictResolver } from './NoteblocksChangesConflictResolver';
import { NotesChangesConflictResolver } from './NotesChangesConflictResolver';

export class ConflictsResolver implements IConflictsResolver {
  private consistencyResolver: ConsistencyResolver;

  constructor(private db: VaultDexieDatabase) {
    this.consistencyResolver = new ConsistencyResolver(db);
  }

  async resolveChanges(
    clientChanges: IDatabaseChange[],
    serverChanges: IDatabaseChange[],
  ) {
    await this.db.transaction('rw', this.tables(), async () => {
      const appliedChanges = await (async () => {
        if (clientChanges.length === 0) {
          // @ts-ignore
          Dexie.currentTransaction.source = 'serverChanges';

          await applyChanges(this.db, serverChanges);

          return serverChanges;
        } else {
          // @ts-ignore
          Dexie.currentTransaction.source = 'conflictsResolution';

          const noteblocksResolver = new NoteblocksChangesConflictResolver();
          const notesResolver = new NotesChangesConflictResolver();

          const noteBlocksFilter = ({ table }: { table: string }) =>
            table === 'noteBlocks';
          const newBlocksChanges = noteblocksResolver.resolveConflicts(
            clientChanges.filter(noteBlocksFilter) as INoteBlockChangeEvent[],
            serverChanges.filter(noteBlocksFilter) as INoteBlockChangeEvent[],
          );

          const notesFilter = ({ table }: { table: string }) =>
            table === 'notes';
          const notesChanges = notesResolver.resolveConflicts(
            clientChanges.filter(notesFilter) as INoteChangeEvent[],
            serverChanges.filter(notesFilter) as INoteChangeEvent[],
          );

          const allChanges = [
            ...notesChanges.changes,
            ...newBlocksChanges.changes,
          ];

          await applyChanges(this.db, allChanges);

          return allChanges;
        }
      })();

      await this.db.transaction('rw', this.tables(), async () => {
        // @ts-ignore
        Dexie.currentTransaction.source = 'conflictsResolution';
        await this.consistencyResolver.resolve(appliedChanges);
      });
    });
  }

  tables() {
    return [this.db.table('notes'), this.db.table('noteBlocks')];
  }
}
