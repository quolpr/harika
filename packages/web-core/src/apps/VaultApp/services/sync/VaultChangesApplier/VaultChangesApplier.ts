import type { DbChangesWriterService } from '../../../../../extensions/SyncExtension/persistence/ApplyChangesService';
import type { ISyncCtx } from '../../../../../extensions/SyncExtension/persistence/syncCtx';
import type { IChangesApplier } from '../../../../../extensions/SyncExtension/serverSynchronizer/ServerSynchronizer';
import type { IDatabaseChange } from '../../../../../extensions/SyncExtension/serverSynchronizer/types';
import {
  BlocksScopesRepository,
  blocksScopesTable,
} from '../../../../../newApps/VaultApplication/NoteBlocksExtension/repositories/BlockScopesRepository';
import type { IBlocksScopesChangeEvent } from '../../../../../newApps/VaultApplication/NoteBlocksExtension/repositories/BlockScopesRepository';
import {
  NotesBlocksRepository,
  noteBlocksTable,
} from '../../../../../newApps/VaultApplication/NoteBlocksExtension/repositories/NotesBlocksRepository';
import type { INoteBlockChangeEvent } from '../../../../../newApps/VaultApplication/NoteBlocksExtension/repositories/NotesBlocksRepository';
import {
  SqlNotesRepository,
  notesTable,
} from '../../../NotesApp/repositories/NotesRepository';
import type { INoteChangeEvent } from '../../../NotesApp/repositories/NotesRepository';
import { BlocksScopesChangesApplier } from '../../../../../newApps/VaultApplication/NoteBlocksExtension/sync/BlocksScopesChangesApplier';
import { NoteblocksChangesApplier } from '../../../../../newApps/VaultApplication/NoteBlocksExtension/sync/NoteblocksChangesApplier';
import { NotesChangesApplier } from '../../../../../newApps/VaultApplication/NotesExtension/sync/NotesChangesApplier';

export class VaultChangesApplier implements IChangesApplier {
  // private consistencyResolver: VaultDbConsistencyResolver;

  constructor(
    private noteRepo: SqlNotesRepository,
    private noteBlocksRepo: NotesBlocksRepository,
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
        const scopesResolver = new BlocksScopesChangesApplier();

        const noteBlocksFilter = ({ table }: { table: string }) =>
          table === noteBlocksTable;
        const newBlocksChanges = noteblocksResolver.resolveChanges(
          clientChanges.filter(noteBlocksFilter) as INoteBlockChangeEvent[],
          serverChanges.filter(noteBlocksFilter) as INoteBlockChangeEvent[],
        );

        const notesFilter = ({ table }: { table: string }) =>
          table === notesTable;
        const notesChanges = notesResolver.resolveChanges(
          clientChanges.filter(notesFilter) as INoteChangeEvent[],
          serverChanges.filter(notesFilter) as INoteChangeEvent[],
        );

        const scopesFilter = ({ table }: { table: string }) =>
          table === blocksScopesTable;
        const scopesChanges = scopesResolver.resolveChanges(
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
