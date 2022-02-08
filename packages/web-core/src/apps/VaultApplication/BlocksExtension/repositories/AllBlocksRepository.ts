import { DB, IQueryExecuter } from '../../../../extensions/DbExtension/DB';
import { inject, injectable, multiInject } from 'inversify';
import { BaseBlockRepository, blocksLinksTable } from './BaseBlockRepository';
import { sqltag, join, raw } from '../../../../lib/sql';
import { SyncConfig } from '../../../../extensions/SyncExtension/serverSynchronizer/SyncConfig';
import { BLOCK_REPOSITORY } from '../types';
import { ISyncCtx } from '../../../../extensions/SyncExtension/syncCtx';
import { groupBy, mapKeys, pickBy } from 'lodash-es';
import { textBlocksTable } from './TextBlocksRepository';

export const blocksChildrenTable = 'blocksChildren' as const;

export type BaseBlockRow = {
  id: string;
  type: string;

  parentId: string | undefined | null;
  linkedBlockIds: string;

  createdAt: number;
  updatedAt: number;
};
export type BaseBlockDoc = {
  id: string;
  type: string;

  parentId: string | undefined | null;
  linkedBlockIds: string[];
  orderPosition: number;

  createdAt: number;
  updatedAt: number;
};

@injectable()
export class AllBlocksRepository {
  private blocksReposMap: Record<string, BaseBlockRepository>;

  constructor(
    @inject(DB) private db: DB,
    @inject(SyncConfig) private syncConfig: SyncConfig,
    @multiInject(BLOCK_REPOSITORY) private blocksRepos: BaseBlockRepository[],
  ) {
    this.blocksReposMap = Object.fromEntries(
      blocksRepos.map((r) => [r.docType, r]),
    );
  }

  get blocksTables(): string[] {
    return this.blocksRepos.map((r) => r.getTableName());
  }

  async getSingleBlocksByIds(ids: string[], e: IQueryExecuter = this.db) {
    const { select, joinTables } = await this.getBlocksQueries('blocks', e);

    return this.joinedRowsToDocs(
      await e.getRecords(sqltag`
      SELECT ${select} FROM (
        ${join(
          ids.map((id) => sqltag`SELECT ${id} as blockId`),
          ' UNION ALL ',
        )}
      ) as blocks
        ${join(joinTables, ' ')}
    `),
    );
  }

  async getDescendantsWithSelf(ids: string[], e: IQueryExecuter = this.db) {
    const { select, joinTables } = await this.getBlocksQueries(
      'childrenBlockIds',
      e,
    );

    return this.joinedRowsToDocs(
      await e.getRecords(sqltag`
      WITH RECURSIVE
        ${this.withDescendants(ids)}
      SELECT ${select} FROM childrenBlockIds
        ${join(joinTables, ' ')}
    `),
    );
  }

  async bulkUpdate(
    docs: BaseBlockDoc[],
    ctx: ISyncCtx,
    e: IQueryExecuter = this.db,
  ) {
    for (const [blockType, blocks] of Object.entries(
      groupBy(docs, (b) => b.type),
    )) {
      const repo = this.blocksRepos.find((r) => r.docType === blockType);

      if (!repo) {
        console.error(`Failed to find repo for ${blockType}`);
        continue;
      }

      await repo.bulkUpdate(blocks, ctx, e);
    }
  }

  async getBacklinkedBlockIds(
    rootBlockId: string,
    includeDescendant = false,
    e: IQueryExecuter = this.db,
  ) {
    const linkedBlockIdsToDescendants = sqltag`
      SELECT blockId, linkedToBlockId FROM ${raw(
        blocksLinksTable,
      )} WHERE linkedToBlockId IN (${
      includeDescendant
        ? sqltag`
        WITH RECURSIVE
          ${this.withDescendants([rootBlockId])}
        SELECT blockId FROM childrenBlockIds
      )`
        : rootBlockId
    })
    `;

    const res = await e.getRecords<{
      blockId: string;
      isRootBlock: 0 | 1;
      linkedToBlockId: string | null;
    }>(sqltag`
      WITH RECURSIVE
        parentBlockIds(blockId, parentId, linkedToBlockId, isRootBlock) AS (
          SELECT b_c_t.blockId, b_c_t.parentId, linksTable.linkedToBlockId, 0 FROM ${raw(
            blocksChildrenTable,
          )} b_c_t JOIN (
            ${linkedBlockIdsToDescendants}
          ) linksTable ON b_c_t.blockId = linksTable.blockId
          UNION ALL
          SELECT a.blockId, a.parentId, NULL, 1 FROM ${raw(
            blocksChildrenTable,
          )} a JOIN parentBlockIds b ON a.blockId = b.parentId LIMIT 10000000
        )
      SELECT parentBlockIds.blockId, parentBlockIds.isRootBlock, parentBlockIds.linkedToBlockId FROM parentBlockIds WHERE parentBlockIds.parentId IS NULL OR parentBlockIds.isRootBlock = 0
    `);

    // Root blocks is needed to load the full blocks tree
    return {
      rootBlockIds: res
        .filter(({ isRootBlock }) => isRootBlock === 1)
        .map(({ blockId }) => blockId),
      linkedBlockIds: res
        .filter(({ isRootBlock }) => isRootBlock === 0)
        .map(({ blockId, linkedToBlockId }) => ({
          blockId,
          linkedToBlockId: linkedToBlockId as string,
        })),
    };
  }

  async bulkRecursiveDelete(
    rootIds: string[],
    ctx: ISyncCtx,
    e: IQueryExecuter = this.db,
  ) {
    // Could be optimized to just take id and type
    const allBlocks = await this.getDescendantsWithSelf(rootIds, e);

    for (const [blockType, blocks] of Object.entries(
      groupBy(allBlocks, (b) => b.type),
    )) {
      const repo = this.blocksRepos.find((r) => r.docType === blockType);

      if (!repo) {
        console.error(`Failed to find repo for ${blockType}`);
        continue;
      }

      await repo.bulkDelete(
        blocks.map(({ id }) => id),
        ctx,
        e,
      );
    }
  }

  // {[id: string] => rootBlockId: string}
  async getRootBlockIds(
    ids: string[],
    e: IQueryExecuter = this.db,
  ): Promise<Record<string, string>> {
    const res = await e.getRecords<{
      blockId: string;
      rootBlockId: string;
    }>(sqltag`
      WITH RECURSIVE
        parentBlockIds(blockId, originalBlockId, parentId) AS (
          VALUES ${join(
            ids.map(
              (id) =>
                sqltag`(${id}, ${id}, (SELECT parentId FROM ${raw(
                  blocksChildrenTable,
                )} WHERE blockId=${id}))`,
            ),
            ', ',
          )}
          UNION ALL
          SELECT a.blockId, b.originalBlockId, a.parentId FROM ${raw(
            blocksChildrenTable,
          )} a JOIN parentBlockIds b ON a.blockId = b.parentId LIMIT 10000000
        )
      SELECT parentBlockIds.blockId AS rootBlockId, parentBlockIds.originalBlockId AS blockId FROM parentBlockIds WHERE parentBlockIds.parentId IS NULL
    `);

    return Object.fromEntries(
      res.map(({ blockId, rootBlockId }) => [blockId, rootBlockId]),
    );
  }

  private async getBlocksQueries(
    tableToJoin: string,
    e: IQueryExecuter = this.db,
  ) {
    return {
      select: join(
        (
          await Promise.all(
            this.blocksRepos.flatMap(async (r) => {
              const tableName = r.getTableName();

              return (await r.getColumnNames(e)).map((c) =>
                raw(`${tableName}.${c} AS ${tableName}_${c}`),
              );
            }),
          )
        ).flat(),
        ', ',
      ),
      joinTables: this.blocksRepos
        .map((r) => r.getTableName())
        .map(
          (tableName) =>
            sqltag`LEFT JOIN ${raw(tableName)} ON ${raw(tableName)}.id = ${raw(
              tableToJoin,
            )}.blockId`,
        ),
    };
  }

  private joinedRowsToDocs(rows: Record<string, unknown>[]) {
    return rows.flatMap((row) => {
      if (Object.values(row).every((r) => r === null)) return [];

      const actualRepo = this.blocksRepos.find(
        (repo) => !!row[`${repo.getTableName()}_id`],
      );

      if (!actualRepo)
        throw new Error(`Failed to determine repo for ${JSON.stringify(row)}`);

      const actualRow = mapKeys(
        pickBy(row, (_v, k) => k.startsWith(actualRepo.getTableName())),
        (_value, key) => key.replace(actualRepo.getTableName() + '_', ''),
      );

      return actualRepo.toDoc(actualRow as BaseBlockRow);
    });
  }

  // async getLinksOfNoteId(
  //   id: string,
  //   e: IQueryExecuter = this.db,
  // ): Promise<Record<string, string[]>> {
  //   const res = await e.getRecords<{ noteId: string; noteBlockId: string }>(
  //     Q.select()
  //       .distinct('joined.noteId noteId, joined.id noteBlockId')
  //       .from(noteBlocksNotesTable)
  //       .leftJoin(`${this.getTableName()} joined`, {
  //         [`${noteBlocksNotesTable}.noteBlockId`]: `joined.id`,
  //       })
  //       .where({ [`${noteBlocksNotesTable}.noteId`]: id }),
  //   );

  //   const grouped: Record<string, string[]> = {};

  //   res.forEach(({ noteId, noteBlockId }) => {
  //     grouped[noteId] ||= [];
  //     grouped[noteId].push(noteBlockId);
  //   });

  //   return grouped;
  // }

  // async getLinkedBlocksOfBlocksOfNote(
  //   noteId: string,
  //   e: IQueryExecuter = this.db,
  // ): Promise<Record<string, { noteId: string; blockId: string }[]>> {
  //   const result = await e.getRecords<{
  //     linkedToBlockId: string;
  //     noteId: string;
  //     blockId: string;
  //   }>(
  //     Q.select(
  //       '*',
  //       Q.select('noteId')
  //         .as('noteId')
  //         .from(noteBlocksTable)
  //         .where(
  //           Q.eq(
  //             `${noteBlocksBlocksTable}.blockId`,
  //             Q(`${noteBlocksTable}.id`),
  //           ),
  //         ),
  //     )
  //       .distinct('noteId, blockId, linkedToBlockId')
  //       .from(noteBlocksBlocksTable)
  //       .where(
  //         Q.in(
  //           'linkedToBlockId',
  //           Q.select('id').from(noteBlocksTable).where({ noteId }),
  //         ),
  //       ),
  //   );

  //   const obj: Record<string, { noteId: string; blockId: string }[]> = {};

  //   result.forEach((res) => {
  //     const toPush = { blockId: res.blockId, noteId: res.noteId };

  //     if (obj[res.linkedToBlockId] !== undefined) {
  //       obj[res.linkedToBlockId].push(toPush);
  //     } else {
  //       obj[res.linkedToBlockId] = [toPush];
  //     }
  //   });

  //   return obj;
  // }

  private withDescendants(ids: string[], tableName = 'childrenBlockIds') {
    const rawBlocksChildrenTable = raw(blocksChildrenTable);

    return sqltag`
      ${raw(tableName)}(blockId, parentId) AS (
        VALUES ${join(
          ids.map((id) => sqltag`(${id}, NULL)`),
          ',',
        )}
        UNION ALL
        SELECT a.blockId, a.parentId FROM ${rawBlocksChildrenTable} a 
          JOIN ${raw(tableName)} b ON a.parentId = b.blockId LIMIT 10000000
      )
    `;
  }
}
