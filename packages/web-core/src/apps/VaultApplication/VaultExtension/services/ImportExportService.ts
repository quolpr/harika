import {
  noteBlocksTable,
  NotesBlocksRepository,
} from '../../NoteBlocksExtension/repositories/NotesBlocksRepository';
import type { NoteBlockDoc } from '../../NoteBlocksExtension/repositories/NotesBlocksRepository';
import {
  BlocksScopesRepository,
  blocksScopesTable,
} from '../../BlocksScopeExtension/repositories/BlockScopesRepository';
import type { ISyncCtx } from '../../../../extensions/SyncExtension/syncCtx';
import { omit } from 'lodash-es';
import { inject, injectable } from 'inversify';
import {
  NoteDoc,
  NotesRepository,
  noteBlocksTable,
} from '../../NotesExtension/repositories/NotesRepository';
import {
  BlocksTreeDescriptorsRepository,
  blocksTreeDescriptorsTable,
} from '../../NoteBlocksExtension/repositories/BlockTreeDescriptorsRepository';

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

  async importData(importData: {
    data: { data: { tableName: string; rows: any[] }[] };
  }) {
    const ctx: ISyncCtx = {
      shouldRecordChange: true,
      source: 'inDbChanges',
    };

    const rootBlockIds =
      importData.data.data
        .find(({ tableName }) => tableName === noteBlocksTable)
        ?.rows.filter(({ rootBlockId }) => rootBlockId)
        .map((note) => [note.id, note.rootBlockId]) || [];

    await this.notesRepo.transaction(async (t) => {
      for (const { rows, tableName } of importData.data.data) {
        if (tableName === noteBlocksTable) {
          await this.notesRepo.bulkCreate(
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
            t,
          );
        } else if (tableName === noteBlocksTable) {
          await this.notesBlocksRepo.bulkCreate(
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
            t,
          );
        } else if (tableName === blocksScopesTable) {
          await this.blocksScopesRepo.bulkCreate(rows, ctx, t);
        } else if (tableName === blocksTreeDescriptorsTable) {
          await this.descriptorRepo.bulkCreate(rows, ctx, t);
        }
      }

      if (rootBlockIds.length > 0) {
        await this.descriptorRepo.bulkCreate(
          rootBlockIds.map(([noteId, rootBlockId]) => ({
            id: noteId,
            rootBlockId: rootBlockId,
          })),
          ctx,
        );
      }
    });
  }

  async exportData() {
    return JSON.stringify({
      data: {
        data: [
          { tableName: noteBlocksTable, rows: await this.notesRepo.getAll() },
          {
            tableName: noteBlocksTable,
            rows: await this.notesBlocksRepo.getAll(),
          },
          {
            tableName: blocksScopesTable,
            rows: await this.blocksScopesRepo.getAll(),
          },
          {
            tableName: blocksTreeDescriptorsTable,
            rows: await this.descriptorRepo.getAll(),
          },
        ],
      },
    });
  }
}
