import {
  noteBlocksTable,
  NotesBlocksRepository,
} from '../../NoteBlocksExtension/repositories/NotesBlocksRepository';
import type { NoteBlockDoc } from '../../NoteBlocksExtension/repositories/NotesBlocksRepository';
import {
  BlocksScopesRepository,
  blocksScopesTable,
} from '../../BlocksScopeExtension/repositories/BlockScopesRepository';
import type { ISyncCtx } from '../../../../extensions/SyncExtension/persistence/syncCtx';
import { omit } from 'lodash-es';
import { inject, injectable } from 'inversify';
import {
  NoteDoc,
  NotesRepository,
  notesTable,
} from '../../NotesExtension/repositories/NotesRepository';

@injectable()
export class ImportExportService {
  constructor(
    @inject(NotesRepository) private notesRepo: NotesRepository,
    @inject(NotesBlocksRepository)
    private notesBlocksRepo: NotesBlocksRepository,
    @inject(BlocksScopesRepository)
    private blocksScopesRepo: BlocksScopesRepository,
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

                const noteDoc: NoteDoc = {
                  id: doc.id,
                  title: doc.title,
                  dailyNoteDate: doc.dailyNoteDate ? doc.dailyNoteDate : null,
                  createdAt: doc.createdAt ? doc.createdAt : null,
                  updatedAt: doc.updatedAt || new Date().getTime(),
                };

                return noteDoc;
              })
              .filter((v) => !!v) as NoteDoc[],
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
                      linkedBlockIds: doc.linkedBlockIds || [],
                      noteBlockIds: doc.noteBlockIds.filter(
                        (v: string | null) => Boolean(v),
                      ),
                    },
                    ['parentBlockId', 'isRoot'],
                  ) as NoteBlockDoc,
              ),
            ctx,
          );
        } else if (tableName === blocksScopesTable) {
          this.blocksScopesRepo.bulkCreate(rows, ctx);
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
          {
            tableName: blocksScopesTable,
            rows: this.blocksScopesRepo.getAll(),
          },
        ],
      },
    });
  }
}