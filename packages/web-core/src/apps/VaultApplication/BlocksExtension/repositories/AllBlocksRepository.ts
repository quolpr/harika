import { inject, injectable, multiInject } from 'inversify';
import { groupBy, mapKeys, pickBy } from 'lodash-es';

import { DB, IQueryExecuter } from '../../../../extensions/DbExtension/DB';
import { SyncConfig } from '../../../../extensions/SyncExtension/serverSynchronizer/SyncConfig';
import { ISyncCtx } from '../../../../extensions/SyncExtension/syncCtx';
import { join, raw, sqltag } from '../../../../lib/sql';
import { BLOCK_REPOSITORY } from '../types';
import { AllBlocksQueries } from './AllBlocksQueries';
import { BaseBlockRepository } from './BaseBlockRepository';

export const blocksChildrenTable = 'blocksChildren' as const;

export type BaseBlockRow = {
  id: string;
  type: string;

  parentId: string | undefined | null;

  createdAt: number;
  updatedAt: number;
};
export type BaseBlockDoc = {
  id: string;
  type: string;

  parentId: string | undefined | null;
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
    @inject(AllBlocksQueries) private allBlocksQueries: AllBlocksQueries,
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
        ${this.allBlocksQueries.getDescendantBlockIds(ids)}
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
}
