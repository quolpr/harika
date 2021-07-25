import { Dexie } from 'dexie';
import {
  IBlocksViewChangeEvent,
  IDatabaseChange,
  INoteBlockChangeEvent,
  INoteChangeEvent,
  VaultDbTables,
} from '../../../dexieTypes';
import { applyChanges } from '../../../dexie-sync/applyChanges';
import type { IConflictsResolver } from '../../../dexie-sync/ServerSynchronizer';
import { ConsistencyResolver } from '../ConsistencyResolver/ConsistencyResolver';
import { NoteblocksChangesConflictResolver } from './NoteblocksChangesConflictResolver';
import { NotesChangesConflictResolver } from './NotesChangesConflictResolver';
import { BlocksViewsChangesConflictResolver } from './BlocksViewsConflictResolver';
import type { VaultDexieDatabase } from '../DexieDb';

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

          const allChanges = [
            ...notesChanges.changes,
            ...newBlocksChanges.changes,
            ...viewsChanges.changes,
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
