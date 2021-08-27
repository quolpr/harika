import { Dexie } from 'dexie';
import {
  IBlocksViewChangeEvent,
  IDatabaseChange,
  INoteBlockChangeEvent,
  INoteChangeEvent,
  VaultDbTables,
} from '../../../dexieTypes';
import { applyChanges } from '../../../dexie-sync/applyChanges';
import type { IChangesApplier } from '../../../dexie-sync/ServerSynchronizer';
import { NoteblocksChangesConflictResolver } from './NoteblocksChangesConflictResolver';
import { NotesChangesConflictResolver } from './NotesChangesConflictResolver';
import { BlocksViewsChangesConflictResolver } from './BlocksViewsConflictResolver';
import type { VaultDexieDatabase } from '../DexieDb';
import { VaultDbConsistencyResolver } from '../ConsistencyResolver/VaultDbConsistencyResolver';

export class ConflictsResolver implements IChangesApplier {
  private consistencyResolver: VaultDbConsistencyResolver;

  constructor(private db: VaultDexieDatabase) {
    this.consistencyResolver = new VaultDbConsistencyResolver(db);
  }

  async resolveChanges(
    clientChanges: IDatabaseChange[],
    serverChanges: IDatabaseChange[],
  ) {
    const { conflictedChanges, notConflictedServerChanges } =
      await (async () => {
        if (clientChanges.length === 0) {
          return {
            notConflictedServerChanges: serverChanges,
            conflictedChanges: [],
          };
        } else {
          // @ts-ignore
          Dexie.currentTransaction.source = 'conflictsResolution';

          const noteblocksResolver = new NoteblocksChangesConflictResolver();
          const notesResolver = new NotesChangesConflictResolver();
          const viewsResolver = new BlocksViewsChangesConflictResolver();

          const noteBlocksFilter = ({ table }: { table: string }) =>
            table === VaultDbTables.NoteBlocks;
          const newBlocksChanges = noteblocksResolver.resolveConflicts(
            clientChanges.filter(noteBlocksFilter) as INoteBlockChangeEvent[],
            serverChanges.filter(noteBlocksFilter) as INoteBlockChangeEvent[],
          );

          const notesFilter = ({ table }: { table: string }) =>
            table === VaultDbTables.Notes;
          const notesChanges = notesResolver.resolveConflicts(
            clientChanges.filter(notesFilter) as INoteChangeEvent[],
            serverChanges.filter(notesFilter) as INoteChangeEvent[],
          );

          const viewsFilter = ({ table }: { table: string }) =>
            table === VaultDbTables.BlocksViews;
          const viewsChanges = viewsResolver.resolveConflicts(
            clientChanges.filter(viewsFilter) as IBlocksViewChangeEvent[],
            serverChanges.filter(viewsFilter) as IBlocksViewChangeEvent[],
          );

          const conflictedChanges = [
            ...notesChanges.conflictedChanges,
            ...newBlocksChanges.conflictedChanges,
            ...viewsChanges.conflictedChanges,
          ];

          const notConflictedServerChanges = [
            ...notesChanges.notConflictedServerChanges,
            ...newBlocksChanges.notConflictedServerChanges,
            ...viewsChanges.notConflictedServerChanges,
          ];

          return { conflictedChanges, notConflictedServerChanges };
        }
      })();

    await this.db.transaction('rw', this.tables(), async () => {
      await this.db.transaction('rw', this.tables(), async () => {
        // @ts-ignore
        Dexie.currentTransaction.source = 'serverChanges';

        await applyChanges(this.db, notConflictedServerChanges);
      });

      await this.db.transaction('rw', this.tables(), async () => {
        // @ts-ignore
        Dexie.currentTransaction.source = 'conflictsResolution';

        await applyChanges(this.db, conflictedChanges);

        if (serverChanges.length > 0) {
          await this.consistencyResolver.resolve();
        }
      });
    });
  }

  tables() {
    return [this.db.table('notes'), this.db.table('noteBlocks')];
  }
}
