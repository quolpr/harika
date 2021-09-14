// import { VaultDbTables } from '../../../dexieTypes';
// import type {
//   IBlocksViewChangeEvent,
//   IDatabaseChange,
//   INoteBlockChangeEvent,
//   INoteChangeEvent,
// } from '../../../dexieTypes';
// import type { IChangesApplier } from '../../../dexie-sync/ServerSynchronizer';
// import { NoteblocksChangesApplier } from './NoteblocksChangesApplier';
// import { NotesChangesApplier } from './NotesChangesApplier';
// import { BlocksViewsChangesConflictResolver } from './BlocksViewsChangesApplier';
// import {
//   blocksViewsTable,
//   DbChangesWriterService,
//   noteBlocksTable,
//   notesTable,
//   SqlBlocksViewsRepository,
//   SqlNotesBlocksRepository,
//   SqlNotesRepository,
// } from '../../../SqlNotesRepository';
// import type { ISyncCtx } from '../../../SqlNotesRepository';

import type { IChangesApplier } from '../../../../db-sync/synchronizer/ServerSynchronizer';
import { VaultDbTables } from '../../../../dexieTypes';
import type {
  IBlocksViewChangeEvent,
  INoteChangeEvent,
  INoteBlockChangeEvent,
  IDatabaseChange,
} from '../../../../dexieTypes';
import {
  blocksViewsTable,
  DbChangesWriterService,
  noteBlocksTable,
  notesTable,
  SqlBlocksViewsRepository,
  SqlNotesBlocksRepository,
  SqlNotesRepository,
} from '../../../../SqlNotesRepository';
import { BlocksViewsChangesConflictResolver } from './BlocksViewsChangesApplier';
import { NotesChangesApplier } from './NotesChangesApplier';
import { NoteblocksChangesApplier } from './NoteblocksChangesApplier';
import type {ISyncCtx} from "../../../../db/DB";

export class VaultChangesApplier implements IChangesApplier {
  // private consistencyResolver: VaultDbConsistencyResolver;

  constructor(
    private noteRepo: SqlNotesRepository,
    private noteBlocksRepo: SqlNotesBlocksRepository,
    private blocksViewsRepo: SqlBlocksViewsRepository,
    private dbChangesWriter: DbChangesWriterService,
  ) {
    // this.consistencyResolver = new VaultDbConsistencyResolver(db);
  }

  async resolveChanges(
    clientChanges: IDatabaseChange[],
    serverChanges: IDatabaseChange[],
  ) {
    const { conflictedChanges, notConflictedServerChanges } = (() => {
      if (clientChanges.length === 0) {
        return {
          notConflictedServerChanges: serverChanges,
          conflictedChanges: [],
        };
      } else {
        const noteblocksResolver = new NoteblocksChangesApplier();
        const notesResolver = new NotesChangesApplier();
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

    this.noteRepo.transaction(() => {
      const allChs: { chs: IDatabaseChange[]; ctx: ISyncCtx }[] = [
        {
          chs: notConflictedServerChanges,
          ctx: { shouldRecordChange: false, source: 'inDbChanges' as const },
        },
        {
          chs: conflictedChanges,
          ctx: { shouldRecordChange: true, source: 'inDbChanges' as const },
        },
      ];

      allChs.forEach(({ chs, ctx }) => {
        const notesChanges = chs.filter(({ table }) => table === notesTable);
        const noteBlocksChanges = chs.filter(
          ({ table }) => table === noteBlocksTable,
        );
        const viewsChanges = chs.filter(
          ({ table }) => table === blocksViewsTable,
        );

        this.dbChangesWriter.writeChanges(notesChanges, this.noteRepo, ctx);
        this.dbChangesWriter.writeChanges(
          noteBlocksChanges,
          this.noteBlocksRepo,
          ctx,
        );
        this.dbChangesWriter.writeChanges(
          viewsChanges,
          this.blocksViewsRepo,
          ctx,
        );
      });

      // if (serverChanges.length > 0) {
      //   await this.consistencyResolver.resolve();
      // }
    });
  }
}
