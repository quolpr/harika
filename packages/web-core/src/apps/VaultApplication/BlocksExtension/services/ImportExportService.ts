import { inject, injectable } from 'inversify';
import { ISyncCtx } from '../../../../extensions/SyncExtension/syncCtx';
import {
  NoteBlockDoc,
  NoteBlocksRepository,
} from '../repositories/NoteBlocksRepostitory';
import {
  TextBlockDoc,
  TextBlocksRepository,
} from '../repositories/TextBlocksRepository';

@injectable()
export class ImportExportService {
  constructor(
    @inject(NoteBlocksRepository)
    private noteBlocksRepository: NoteBlocksRepository,
    @inject(TextBlocksRepository)
    private textBlocksRepository: TextBlocksRepository,
  ) {}

  async importData(importData: {
    data: { data: { tableName: string; rows: any[] }[] };
    version: undefined;
  }) {
    const ctx: ISyncCtx = {
      shouldRecordChange: true,
      source: 'inDbChanges',
    };

    // childId => parentId
    const relations: Record<
      string,
      { parentId: string; orderPosition: number }
    > = {};

    if (importData.version === undefined) {
      for (const { rows, tableName } of importData.data.data) {
        if (tableName === 'noteBlocks') {
          rows.forEach(
            ({ noteBlockIds, id }: { noteBlockIds: string[]; id: string }) => {
              noteBlockIds.forEach((childBlockId: string, i) => {
                relations[childBlockId] = { parentId: id, orderPosition: i };
              });
            },
          );
        }
      }

      const keys = Object.keys(relations);

      const rootBlocksIds: Set<string> = new Set();

      for (const { rows, tableName } of importData.data.data) {
        if (tableName === 'blocksTreesDescriptors') {
          // id = noteId
          rows.forEach(
            ({ id, rootBlockId }: { id: string; rootBlockId: string }) => {
              rootBlocksIds.add(rootBlockId);

              const childIdsOfRootBlock = keys.filter(
                (k) => relations[k].parentId === rootBlockId,
              );

              childIdsOfRootBlock.forEach((childId) => {
                // Instead of root block let's use just note block as root
                relations[childId].parentId = id;
              });
            },
          );
        }
      }

      console.log({ relations });

      const textBlocks = importData.data.data.flatMap(({ rows, tableName }) => {
        if (tableName === 'noteBlocks') {
          return rows.flatMap((row): TextBlockDoc | never[] => {
            if (rootBlocksIds.has(row.id)) return [];
            if (!relations[row.id]) return [];

            return {
              id: row.id,
              type: 'textBlock',
              parentId: relations[row.id].parentId,
              linkedBlockIds: row.linkedBlockIds.concat(row.linkedNoteIds),
              orderPosition: relations[row.id].orderPosition,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
              content: row.content,
            };
          });
        } else {
          return [];
        }
      });

      const noteBlocks = importData.data.data.flatMap(({ rows, tableName }) => {
        if (tableName === 'notes') {
          return rows.map((row): NoteBlockDoc => {
            return {
              id: row.id,
              type: 'noteBlock',
              parentId: undefined,
              linkedBlockIds: [],
              orderPosition: row.createdAt,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
              title: row.title,
              dailyNoteDate: row.dailyNoteDate,
            };
          });
        } else {
          return [];
        }
      });

      await this.noteBlocksRepository.transaction(async (t) => {
        await this.noteBlocksRepository.bulkCreate(noteBlocks, ctx, t);
        await this.textBlocksRepository.bulkCreate(textBlocks, ctx, t);
      });
    }
    // const rootBlockIds =
    //   importData.data.data
    //     .find(({ tableName }) => tableName === noteBlocksTable)
    //     ?.rows.filter(({ rootBlockId }) => rootBlockId)
    //     .map((note) => [note.id, note.rootBlockId]) || [];
    // await this.notesRepo.transaction(async (t) => {
    //   for (const { rows, tableName } of importData.data.data) {
    //     if (tableName === noteBlocksTable) {
    //       await this.notesRepo.bulkCreate(
    //         rows
    //           .filter(({ title }) => title !== undefined)
    //           .map((doc) => {
    //             const noteDoc: NoteDoc = {
    //               id: doc.id,
    //               title: doc.title,
    //               dailyNoteDate: doc.dailyNoteDate ? doc.dailyNoteDate : null,
    //               createdAt: doc.createdAt ? doc.createdAt : null,
    //               updatedAt: doc.updatedAt || new Date().getTime(),
    //             };
    //             return noteDoc;
    //           })
    //           .filter((v) => !!v) as NoteDoc[],
    //         ctx,
    //         t,
    //       );
    //     } else if (tableName === noteBlocksTable) {
    //       await this.notesBlocksRepo.bulkCreate(
    //         rows
    //           .filter((doc) => Boolean(doc.noteId))
    //           .map(
    //             (doc) =>
    //               omit(
    //                 {
    //                   ...doc,
    //                   updatedAt: doc.updatedAt || new Date().getTime(),
    //                   linkedNoteIds: doc.linkedNoteIds.filter(
    //                     (v: string | null) => Boolean(v),
    //                   ),
    //                   linkedBlockIds: doc.linkedBlockIds || [],
    //                   noteBlockIds: doc.noteBlockIds.filter(
    //                     (v: string | null) => Boolean(v),
    //                   ),
    //                 },
    //                 ['parentBlockId', 'isRoot'],
    //               ) as NoteBlockDoc,
    //           ),
    //         ctx,
    //         t,
    //       );
    //     } else if (tableName === blocksScopesTable) {
    //       await this.blocksScopesRepo.bulkCreate(rows, ctx, t);
    //     } else if (tableName === blocksTreeDescriptorsTable) {
    //       await this.descriptorRepo.bulkCreate(rows, ctx, t);
    //     }
    //   }
    //   if (rootBlockIds.length > 0) {
    //     await this.descriptorRepo.bulkCreate(
    //       rootBlockIds.map(([noteId, rootBlockId]) => ({
    //         id: noteId,
    //         rootBlockId: rootBlockId,
    //       })),
    //       ctx,
    //     );
    //   }
    // });
  }

  async exportData() {
    // return JSON.stringify({
    //   data: {
    //     data: [
    //       { tableName: noteBlocksTable, rows: await this.notesRepo.getAll() },
    //       {
    //         tableName: noteBlocksTable,
    //         rows: await this.notesBlocksRepo.getAll(),
    //       },
    //       {
    //         tableName: blocksScopesTable,
    //         rows: await this.blocksScopesRepo.getAll(),
    //       },
    //       {
    //         tableName: blocksTreeDescriptorsTable,
    //         rows: await this.descriptorRepo.getAll(),
    //       },
    //     ],
    //   },
    // });
    return '';
  }
}
