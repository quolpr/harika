import type { DbChangesWriterService } from '../../../../db-sync/persistence/ApplyChangesService';
import type { ISyncCtx } from '../../../../db-sync/persistence/syncCtx';
import type { IChangesApplier } from '../../../../db-sync/synchronizer/ServerSynchronizer';
import type { IDatabaseChange } from '../../../../db-sync/synchronizer/types';
import {
  BlocksScopesRepository,
  blocksScopesTable,
} from '../../BlockScopesRepository';
import type { IBlocksScopesChangeEvent } from '../../BlockScopesRepository';
import {
  SqlNotesBlocksRepository,
  noteBlocksTable,
} from '../../NotesBlocksRepository';
import type { INoteBlockChangeEvent } from '../../NotesBlocksRepository';
import { SqlNotesRepository, notesTable } from '../../NotesRepository';
import type { INoteChangeEvent } from '../../NotesRepository';
import { BlocksScopesChangesConflictResolver } from './BlocksScopesChangesApplier';
import { NoteblocksChangesApplier } from './NoteblocksChangesApplier';
import { NotesChangesApplier } from './NotesChangesApplier';

export class VaultChangesApplier implements IChangesApplier {
  // private consistencyResolver: VaultDbConsistencyResolver;

  constructor(
    private noteRepo: SqlNotesRepository,
    private noteBlocksRepo: SqlNotesBlocksRepository,
    private blocksScopesRepo: BlocksScopesRepository,
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
        const scopesResolver = new BlocksScopesChangesConflictResolver();

        const noteBlocksFilter = ({ table }: { table: string }) =>
          table === noteBlocksTable;
        const newBlocksChanges = noteblocksResolver.resolveConflicts(
          clientChanges.filter(noteBlocksFilter) as INoteBlockChangeEvent[],
          serverChanges.filter(noteBlocksFilter) as INoteBlockChangeEvent[],
        );

        const notesFilter = ({ table }: { table: string }) =>
          table === notesTable;
        const notesChanges = notesResolver.resolveConflicts(
          clientChanges.filter(notesFilter) as INoteChangeEvent[],
          serverChanges.filter(notesFilter) as INoteChangeEvent[],
        );

        const scopesFilter = ({ table }: { table: string }) =>
          table === blocksScopesTable;
        const scopesChanges = scopesResolver.resolveConflicts(
          clientChanges.filter(scopesFilter) as IBlocksScopesChangeEvent[],
          serverChanges.filter(scopesFilter) as IBlocksScopesChangeEvent[],
        );

        const conflictedChanges = [
          ...notesChanges.conflictedChanges,
          ...newBlocksChanges.conflictedChanges,
          ...scopesChanges.conflictedChanges,
        ];

        const notConflictedServerChanges = [
          ...notesChanges.notConflictedServerChanges,
          ...newBlocksChanges.notConflictedServerChanges,
          ...scopesChanges.notConflictedServerChanges,
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
        const scopesChanges = chs.filter(
          ({ table }) => table === blocksScopesTable,
        );

        this.dbChangesWriter.writeChanges(notesChanges, this.noteRepo, ctx);
        this.dbChangesWriter.writeChanges(
          noteBlocksChanges,
          this.noteBlocksRepo,
          ctx,
        );
        this.dbChangesWriter.writeChanges(
          scopesChanges,
          this.blocksScopesRepo,
          ctx,
        );
      });

      // if (serverChanges.length > 0) {
      //   await this.consistencyResolver.resolve();
      // }
    });
  }
}