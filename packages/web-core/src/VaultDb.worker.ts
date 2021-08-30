// import { expose, proxy } from 'comlink';
// import { VaultChangesApplier } from './VaultContext/persistence/VaultChangesApplier/VaultChangesApplier';
// import {
//   BaseDbWorker,
//   ApplyChangesService,
//   SqlNotesRepository,
//   SqlNotesBlocksRepository,
//   DbChangesWriterService,
//   SqlBlocksViewsRepository,
// } from './SqlNotesRepository';

import { expose, proxy } from 'comlink';
import {
  ApplyChangesService,
  BaseDbWorker,
  blocksViewsTable,
  DbChangesWriterService,
  noteBlocksTable,
  notesTable,
  SqlBlocksViewsRepository,
  SqlNotesBlocksRepository,
  SqlNotesRepository,
} from './SqlNotesRepository';
import type { ISyncCtx } from './SqlNotesRepository';
import { VaultChangesApplier } from './VaultContext/persistence/VaultChangesApplier/VaultChangesApplier';
import type { NoteBlockDocType, NoteDocType } from './dexieTypes';
import { omit } from 'lodash-es';

export class ImportExportService {
  constructor(
    private notesRepo: SqlNotesRepository,
    private notesBlocksRepo: SqlNotesBlocksRepository,
    private blocksViewsRepo: SqlBlocksViewsRepository,
  ) {}

  importData(importData: {
    data: { data: { tableName: string; rows: any[] }[] };
  }) {
    const ctx: ISyncCtx = {
      shouldRecordChange: true,
      source: 'inDbChanges',
    };

    this.notesRepo.transaction(() => {
      importData.data.data.forEach(({ rows, tableName }) => {
        if (tableName === notesTable) {
          this.notesRepo.bulkCreate(
            rows
              .filter(({ title }) => title !== undefined)
              .map(
                (doc) =>
                  ({
                    id: doc.id,
                    title: doc.title,
                    dailyNoteDate: doc.dailyNoteDate ? doc.dailyNoteDate : null,
                    createdAt: doc.createdAt ? doc.createdAt : null,
                    updatedAt: doc.updatedAt || new Date().getTime(),
                  } as NoteDocType),
              ),
            ctx,
          );
        } else if (tableName === noteBlocksTable) {
          this.notesBlocksRepo.bulkCreate(
            rows
              .filter((doc) => Boolean(doc.noteId))
              .map(
                (doc) =>
                  omit(
                    {
                      ...doc,
                      updatedAt: doc.updatedAt || new Date().getTime(),
                      linkedNoteIds: doc.linkedNoteIds.filter(
                        (v: string | null) => Boolean(v),
                      ),
                      noteBlockIds: doc.noteBlockIds.filter(
                        (v: string | null) => Boolean(v),
                      ),
                    },
                    ['parentBlockId'],
                  ) as NoteBlockDocType,
              ),
            ctx,
          );
        } else if (tableName === blocksViewsTable) {
          this.blocksViewsRepo.bulkCreate(rows, ctx);
        }
      });
    });
  }

  exportData() {
    return JSON.stringify({
      data: {
        data: [
          { tableName: notesTable, rows: this.notesRepo.getAll() },
          { tableName: noteBlocksTable, rows: this.notesBlocksRepo.getAll() },
          { tableName: blocksViewsTable, rows: this.blocksViewsRepo.getAll() },
        ],
      },
    });
  }
}

export class DeleteNoteService {
  constructor(
    private notesRepo: SqlNotesRepository,
    private notesBlocksRepo: SqlNotesBlocksRepository,
  ) {}

  deleteNote(noteId: string) {
    const ctx: ISyncCtx = {
      shouldRecordChange: true,
      source: 'inDbChanges',
    };
    this.notesRepo.transaction(() => {
      const linkedBlocks = this.notesBlocksRepo.getLinkedBlocksOfNoteId(noteId);

      if (linkedBlocks.length > 0) {
        linkedBlocks.forEach((block) => {
          block.linkedNoteIds = block.linkedNoteIds.filter(
            (id) => id !== noteId,
          );
        });
        this.notesBlocksRepo.bulkUpdate(linkedBlocks, ctx);
      }

      this.notesRepo.delete(noteId, ctx);
      this.notesBlocksRepo.bulkDelete(
        this.notesBlocksRepo.getIdsByNoteId(noteId),
        ctx,
      );
    });
  }
}

export class VaultDbWorker extends BaseDbWorker {
  getNotesRepo() {
    return proxy(this.getNotesRepoWithoutProxy());
  }

  getNotesBlocksRepo() {
    return proxy(this.getNoteBlocksRepoWithoutProxy());
  }

  getBlocksViewsRepo() {
    return proxy(this.getBlocksViewRepoWithoutProxy());
  }

  getImportExportService() {
    return proxy(
      new ImportExportService(
        this.getNotesRepoWithoutProxy(),
        this.getNoteBlocksRepoWithoutProxy(),
        this.getBlocksViewRepoWithoutProxy(),
      ),
    );
  }

  getDeleteNoteService() {
    return proxy(
      new DeleteNoteService(
        this.getNotesRepoWithoutProxy(),
        this.getNoteBlocksRepoWithoutProxy(),
      ),
    );
  }

  private getBlocksViewRepoWithoutProxy() {
    return new SqlBlocksViewsRepository(this.syncRepo, this.db, this.windowId);
  }

  private getNotesRepoWithoutProxy() {
    return new SqlNotesRepository(this.syncRepo, this.db, this.windowId);
  }

  private getNoteBlocksRepoWithoutProxy() {
    return new SqlNotesBlocksRepository(this.syncRepo, this.db, this.windowId);
  }

  getApplyChangesService() {
    return proxy(
      new ApplyChangesService(
        new VaultChangesApplier(
          this.getNotesRepoWithoutProxy(),
          this.getNoteBlocksRepoWithoutProxy(),
          this.getBlocksViewRepoWithoutProxy(),
          new DbChangesWriterService(),
        ),
        this.syncRepo,
      ),
    );
  }
}

expose(VaultDbWorker);
