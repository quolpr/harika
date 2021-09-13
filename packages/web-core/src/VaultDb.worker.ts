import { expose, proxy } from 'comlink';
import {
  ApplyChangesService,
  BaseDbWorker,
  blocksViewsTable,
  DB,
  DbChangesWriterService,
  noteBlocksFTSTable,
  noteBlocksTable,
  notesFTSTable,
  notesTable,
  SqlBlocksViewsRepository,
  SqlNotesBlocksRepository,
  SqlNotesRepository,
} from './SqlNotesRepository';
import type { ISyncCtx } from './SqlNotesRepository';
import { VaultChangesApplier } from './VaultContext/persistence/VaultChangesApplier/VaultChangesApplier';
import type { NoteBlockDocType, NoteDocType } from './dexieTypes';
import { omit } from 'lodash-es';
import Q from 'sql-bricks';

export class FindNoteOrBlockService {
  constructor(
    private db: DB, // private notesRepo: SqlNotesRepository, // private notesBlocksRepo: SqlNotesBlocksRepository,
  ) {}

  find(text: string) {
    text = text.toLowerCase().trim();

    const res = this.db.getRecords<{
      noteId: string;
      noteBlockId: string | null;
      tableType: typeof notesTable | typeof noteBlocksTable;
      data: string;
    }>(
      // Only in nested selects order will work
      Q.select()
        .from(
          Q.select()
            .from(
              Q.select(
                'NULL as noteBlockId',
                `'${notesTable}' tableType`,
                Q.select('title')
                  .as('data')
                  .from(notesTable)
                  .where(Q(`id = ${notesFTSTable}.id`)),
                'id noteId',
                `bm25(${notesFTSTable}) rank`,
              )
                .from(notesFTSTable)
                .where(Q.like('title', `%${text}%`)),
            )
            .union(
              Q.select().from(
                Q.select(
                  'id noteBlockId',
                  `'${noteBlocksTable}' tableType`,
                  Q.select('content')
                    .as('data')
                    .from(noteBlocksTable)
                    .where(Q(`id = ${noteBlocksFTSTable}.id`)),
                  Q.select('noteId')
                    .as('noteId')
                    .from(noteBlocksTable)
                    .where(Q(`id = ${noteBlocksFTSTable}.id`)),
                  `bm25(${noteBlocksFTSTable}) rank`,
                )
                  .from(noteBlocksFTSTable)
                  // @ts-ignore
                  .where(Q.like('textContent', `%${text}%`)),
              ),
            ),
        )
        .orderBy(`CASE tableType WHEN '${notesTable}' THEN 0 ELSE 1 END, rank`),
    );

    return res;
  }

  findNote(text: string) {
    text = text.toLowerCase().trim();

    const res = this.db.getRecords<{
      id: string;
      title: string;
    }>(
      Q.select(
        'id',
        Q.select('title')
          .as('title')
          .from(notesTable)
          .where(Q(`id = ${notesFTSTable}.id`)),
      )
        .from(notesFTSTable)
        .where(Q.like('title', `%${text}%`))
        .orderBy('rank'),
    );

    return res;
  }
}

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

    const rootBlockIds = Object.fromEntries(
      importData.data.data
        .find(({ tableName }) => tableName === noteBlocksTable)
        ?.rows.filter(({ isRoot }) => isRoot)
        .map((block) => [block.noteId, block.id]) || [],
    );

    this.notesRepo.transaction(() => {
      importData.data.data.forEach(({ rows, tableName }) => {
        if (tableName === notesTable) {
          this.notesRepo.bulkCreate(
            rows
              .filter(({ title }) => title !== undefined)
              .map((doc) => {
                const rootBlockId = doc.rootBlockId || rootBlockIds[doc.id];

                if (rootBlockId === undefined) {
                  console.error('Root block not found for note', doc);

                  return undefined;
                }

                const noteDoc: NoteDocType = {
                  id: doc.id,
                  title: doc.title,
                  dailyNoteDate: doc.dailyNoteDate ? doc.dailyNoteDate : null,
                  createdAt: doc.createdAt ? doc.createdAt : null,
                  updatedAt: doc.updatedAt || new Date().getTime(),
                  rootBlockId: doc.rootBlockId || rootBlockIds[doc.id],
                };

                return noteDoc;
              })
              .filter((v) => !!v) as NoteDocType[],
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
                    ['parentBlockId', 'isRoot'],
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
  getFindService() {
    return proxy(new FindNoteOrBlockService(this.db));
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
