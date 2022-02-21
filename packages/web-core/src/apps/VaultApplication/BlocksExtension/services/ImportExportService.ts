import { inject, injectable } from 'inversify';

import { ISyncCtx } from '../../../../extensions/SyncExtension/syncCtx';
import { generateId } from '../../../../lib/generateId';
import {
  BlockLinkRow,
  BlockLinksRepository,
  blockLinksTable,
} from '../repositories/BlockLinkRepository';
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

export interface Dump {
  version: number;
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
    @inject(BlockLinksRepository)
    private blockLinksRepo: BlockLinksRepository,
  ) {}

  async importData(dump: OldVersionDump | Dump) {
    if (dump.version === undefined) {
      await this.oldVersionImport(dump);
    } else if (dump.version === 1) {
      await this.firstVersionImport(dump);
    } else if (dump.version === 2) {
      await this.secondVersionImport(dump);
    }
  }

  private async firstVersionImport(dump: Dump) {
    const ctx: ISyncCtx = {
      shouldRecordChange: true,
      source: 'inDbChanges',
    };

    let i = 0;

    const links: BlockLinkRow[] = [];

    await this.noteBlocksRepository.transaction(async (t) => {
      for (const { tableName, rows } of dump.data) {
        if (tableName === noteBlocksTable) {
          // eslint-disable-next-line no-loop-func
          rows.forEach((row) => {
            row.linkedBlockIds.forEach((id: string) => {
              links.push({
                id: generateId(),
                blockId: row.id,
                linkedToBlockId: id,
                orderPosition: i++,
                createdAt: new Date().getTime(),
                updatedAt: new Date().getTime(),
              });
            });

            delete row['linkedBlockIds'];
          });

          await this.noteBlocksRepository.bulkCreate(rows, ctx, t);
        } else if (tableName === textBlocksTable) {
          // eslint-disable-next-line no-loop-func
          rows.forEach((row) => {
            row.linkedBlockIds.forEach((id: string) => {
              links.push({
                id: generateId(),
                blockId: row.id,
                linkedToBlockId: id,
                orderPosition: i++,
                createdAt: new Date().getTime(),
                updatedAt: new Date().getTime(),
              });
            });

            delete row['linkedBlockIds'];
          });

          await this.textBlocksRepository.bulkCreate(rows, ctx, t);
        } else if (tableName === blocksScopesTable) {
          await this.blocksScopesRepository.bulkCreate(rows, ctx, t);
        }
      }

      await this.blockLinksRepo.bulkCreate(links, ctx, t);
    });
  }

  private async secondVersionImport(dump: Dump) {
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
        } else if (tableName === blockLinksTable) {
          await this.blockLinksRepo.bulkCreate(rows, ctx, t);
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
              // linkedBlockIds: row.linkedBlockIds.concat(row.linkedNoteIds),
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
              // linkedBlockIds: [],
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
    const dump: Dump = {
      version: 2,
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
        {
          tableName: blockLinksTable,
          rows: await this.blockLinksRepo.getAll(),
        },
      ],
    };
    return JSON.stringify(dump);
  }
}
