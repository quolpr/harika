import { IDocChange } from '@harika/sync-common';
import { inject, injectable } from 'inversify';
import { chunk } from 'lodash-es';
import sql, { join, raw } from 'sql-template-tag';

import { DB, IQueryExecuter } from '../../../../extensions/DbExtension/DB';
import { BaseSyncRepository } from '../../../../extensions/SyncExtension/BaseSyncRepository';
import { SyncRepository } from '../../../../extensions/SyncExtension/repositories/SyncRepository';
import { WINDOW_ID } from '../../../../framework/types';
import { AllBlocksQueries } from '../../BlocksExtension/repositories/AllBlocksQueries';
import { blocksChildrenTable } from '../../BlocksExtension/repositories/AllBlocksRepository';

export const blockLinksTable = 'blockLinks' as const;

export type BlockLinkRow = {
  id: string;
  blockId: string;
  linkedToBlockId: string;
  orderPosition: number;
  createdAt: number;
  updatedAt: number;
};
export type BlockLinkDoc = BlockLinkRow;

export type IBlocksScopesChangeEvent = IDocChange<
  typeof blockLinksTable,
  BlockLinkDoc
>;

@injectable()
export class BlockLinksRepository extends BaseSyncRepository<
  BlockLinkDoc,
  BlockLinkRow
> {
  constructor(
    @inject(SyncRepository) protected syncRepository: SyncRepository,
    @inject(DB) protected db: DB,
    @inject(WINDOW_ID) protected windowId: string,
    @inject(AllBlocksQueries) private allBlocksQueries: AllBlocksQueries,
  ) {
    super(syncRepository, db, windowId);
  }

  async getAllLinksOfBlocks(blockIds: string[], e: IQueryExecuter = this.db) {
    return await e.getRecords<BlockLinkRow>(sql`
      SELECT * FROM ${raw(blockLinksTable)} WHERE blockId IN (
        ${join(blockIds)}
      ) OR linkedToBlockId IN (
        ${join(blockIds)}
      )
    `);
  }

  async getLinksOfDescendants(
    rootBlockIds: string[],
    e: IQueryExecuter = this.db,
  ) {
    const rows: BlockLinkRow[] = [];

    for (const chunkedRootBlockIds of chunk(rootBlockIds, 400)) {
      const chunkedRows = await e.getRecords<BlockLinkRow>(sql`
        SELECT * FROM ${raw(blockLinksTable)} WHERE blockId IN (
          WITH RECURSIVE
            ${this.allBlocksQueries.getDescendantBlockIds(chunkedRootBlockIds)}
          SELECT blockId FROM childrenBlockIds
        )`);

      rows.push(...chunkedRows);
    }

    return rows;
  }

  async getBacklinksOfDescendants(
    rootBlockId: string,
    includeDescendant = false,
    e: IQueryExecuter = this.db,
  ) {
    const linkedBlockIdsToDescendants = sql`
      SELECT * FROM ${raw(blockLinksTable)} WHERE linkedToBlockId IN (${
      includeDescendant
        ? sql`
        WITH RECURSIVE
          ${this.allBlocksQueries.getDescendantBlockIds([rootBlockId])}
        SELECT blockId FROM childrenBlockIds
      )`
        : rootBlockId
    })
    `;

    const res = await e.getRecords<
      | {
          blockId: string;
          isRootBlock: 1;
        }
      | (BlockLinkRow & {
          isRootBlock: 0;
        })
    >(sql`
      WITH RECURSIVE
        parentBlockIds(id, blockId, parentId, linkedToBlockId, isRootBlock, orderPosition, createdAt, updatedAt) AS (
          SELECT linksTable.id, b_c_t.blockId, b_c_t.parentId, linksTable.linkedToBlockId, 0, linksTable.orderPosition, linksTable.createdAt, linksTable.updatedAt FROM ${raw(
            blocksChildrenTable,
          )} b_c_t JOIN (
            ${linkedBlockIdsToDescendants}
          ) linksTable ON b_c_t.blockId = linksTable.blockId
          UNION ALL
          SELECT NULL, a.blockId, a.parentId, NULL, 1, NULL, NULL, NULL FROM ${raw(
            blocksChildrenTable,
          )} a JOIN parentBlockIds b ON a.blockId = b.parentId LIMIT 10000000
        )
      SELECT * FROM parentBlockIds WHERE parentBlockIds.parentId IS NULL OR parentBlockIds.isRootBlock = 0
    `);

    // Root blocks is needed to load the full blocks tree
    return {
      rootBlockIdsOfLinkedBlocks: res.flatMap(({ blockId, isRootBlock }) =>
        isRootBlock ? blockId : [],
      ),
      links: res.flatMap((row) => (!row.isRootBlock ? this.toDoc(row) : [])),
    };
  }

  getTableName() {
    return blockLinksTable;
  }
}
