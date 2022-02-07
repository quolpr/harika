import { inject, injectable } from 'inversify';
import { ISyncCtx } from '../../../../extensions/SyncExtension/syncCtx';
import {
  BlocksScopesRepository,
  blocksScopesTable,
} from '../repositories/BlockScopesRepository';
import {
  NoteBlockDoc,
  NoteBlocksRepository,
  noteBlocksTable,
} from '../repositories/NoteBlocksRepostitory';
import {
  TextBlockDoc,
  TextBlocksRepository,
  textBlocksTable,
} from '../repositories/TextBlocksRepository';

interface OldVersionDump {
  version: undefined;
  data: {
    data: {
      tableName: string;
      rows: any[];
    }[];
  };
}

interface V1Dump {
  version: 1;
  data: {
    tableName: string;
    rows: any[];
  }[];
}

@injectable()
export class ImportExportService {
  constructor(
    @inject(NoteBlocksRepository)
    private noteBlocksRepository: NoteBlocksRepository,
    @inject(TextBlocksRepository)
    private textBlocksRepository: TextBlocksRepository,
    @inject(BlocksScopesRepository)
    private blocksScopesRepository: BlocksScopesRepository,
  ) {}

  async importData(dump: OldVersionDump | V1Dump) {
    if (dump.version === undefined) {
      await this.oldVersionImport(dump);
    } else if (dump.version === 1) {
      await this.firstVersionImport(dump);
    }
  }

  private async firstVersionImport(dump: V1Dump) {
    const ctx: ISyncCtx = {
      shouldRecordChange: true,
      source: 'inDbChanges',
    };

    await this.noteBlocksRepository.transaction(async (t) => {
      for (const { tableName, rows } of dump.data) {
        if (tableName === noteBlocksTable) {
          await this.noteBlocksRepository.bulkCreate(rows, ctx, t);
        } else if (tableName === textBlocksTable) {
          await this.textBlocksRepository.bulkCreate(rows, ctx, t);
        } else if (tableName === blocksScopesTable) {
          await this.blocksScopesRepository.bulkCreate(rows, ctx, t);
        }
      }
    });
  }

  private async oldVersionImport(dump: OldVersionDump) {
    const ctx: ISyncCtx = {
      shouldRecordChange: true,
      source: 'inDbChanges',
    };

    // childId => parentId
    const relations: Record<
      string,
      { parentId: string; orderPosition: number }
    > = {};

    if (dump.version === undefined) {
      for (const { rows, tableName } of dump.data.data) {
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

      for (const { rows, tableName } of dump.data.data) {
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

      const textBlocks = dump.data.data.flatMap(({ rows, tableName }) => {
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

      const noteBlocks = dump.data.data.flatMap(({ rows, tableName }) => {
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
  }

  async exportData() {
    const dump: V1Dump = {
      version: 1,
      data: [
        {
          tableName: noteBlocksTable,
          rows: await this.noteBlocksRepository.getAll(),
        },
        {
          tableName: textBlocksTable,
          rows: await this.textBlocksRepository.getAll(),
        },
        {
          tableName: blocksScopesTable,
          rows: await this.blocksScopesRepository.getAll(),
        },
      ],
    };
    return JSON.stringify(dump);
  }
}
