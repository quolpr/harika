import {
  noteBlocksTable,
  NotesBlocksRepository,
} from '../../../NoteBlocksExtension/worker/repositories/NotesBlocksRepository';
import type { NoteBlockDoc } from '../../../NoteBlocksExtension/worker/repositories/NotesBlocksRepository';
import {
  BlocksScopesRepository,
  blocksScopesTable,
} from '../../../BlocksScopeExtension/worker/repositories/BlockScopesRepository';
import type { ISyncCtx } from '../../../../../extensions/SyncExtension/worker/syncCtx';
import { omit } from 'lodash-es';
import { inject, injectable } from 'inversify';
import {
  NoteDoc,
  NotesRepository,
  notesTable,
} from '../../../NotesExtension/worker/repositories/NotesRepository';
import {
  BlocksTreeDescriptorsRepository,
  blocksTreeDescriptorsTable,
} from '../../../NoteBlocksExtension/worker/repositories/BlockTreeDescriptorsRepository';
import { BlocksTreeDescriptor } from '../../../NoteBlocksExtension/app/models/BlocksTreeDescriptor';

@injectable()
export class ImportExportService {
  constructor(
    @inject(NotesRepository) private notesRepo: NotesRepository,
    @inject(NotesBlocksRepository)
    private notesBlocksRepo: NotesBlocksRepository,
    @inject(BlocksScopesRepository)
    private blocksScopesRepo: BlocksScopesRepository,
    @inject(BlocksTreeDescriptorsRepository)
    private descriptorRepo: BlocksTreeDescriptorsRepository,
  ) {}

  importData(importData: {
    data: { data: { tableName: string; rows: any[] }[] };
  }) {
    const ctx: ISyncCtx = {
      shouldRecordChange: true,
      source: 'inDbChanges',
    };

    const rootBlockIds =
      importData.data.data
        .find(({ tableName }) => tableName === notesTable)
        ?.rows.filter(({ rootBlockId }) => rootBlockId)
        .map((note) => [note.id, note.rootBlockId]) || [];

    this.notesRepo.transaction(() => {
      importData.data.data.forEach(({ rows, tableName }) => {
        if (tableName === notesTable) {
          this.notesRepo.bulkCreate(
            rows
              .filter(({ title }) => title !== undefined)
              .map((doc) => {
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
        } else if (tableName === blocksTreeDescriptorsTable) {
          this.descriptorRepo.bulkCreate(rows, ctx);
        }
      });

      if (rootBlockIds.length > 0) {
        this.descriptorRepo.bulkCreate(
          rootBlockIds.map(([noteId, rootBlockId]) => ({
            id: noteId,
            rootBlockId: rootBlockId,
          })),
          ctx,
        );
      }
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
          {
            tableName: blocksTreeDescriptorsTable,
            rows: this.descriptorRepo.getAll(),
          },
        ],
      },
    });
  }
}
