import { DB, IQueryExecuter } from '../../../../extensions/DbExtension/DB';
import { inject, injectable, multiInject } from 'inversify';
import { BaseBlockRepository, blocksLinksTable } from './BaseBlockRepository';
import { sqltag, join, raw } from '../../../../lib/sql';
import { SyncConfig } from '../../../../extensions/SyncExtension/serverSynchronizer/SyncConfig';
import { BLOCK_REPOSITORY } from '../types';
import { ISyncCtx } from '../../../../extensions/SyncExtension/syncCtx';
import { mapKeys, pickBy } from 'lodash';

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

  // TODO
  async getSingleBlocksByIds(ids: string[], e: IQueryExecuter = this.db) {}

  async getDescendantsWithSelf(ids: string[], e: IQueryExecuter = this.db) {
    const joinTables = this.blocksRepos
      .map((r) => r.getTableName())
      .map(
        (tableName) =>
          sqltag`LEFT JOIN ${raw(tableName)} ON ${raw(
            tableName,
          )}.id = childrenBlockIds.blockId`,
      );

    const selects = join(
      (
        await Promise.all(
          this.blocksRepos.flatMap(async (r) => {
            const tableName = r.getTableName();

            return (await r.getColumnNames()).map((c) =>
              raw(`${tableName}.${c} AS ${tableName}_${c}`),
            );
          }),
        )
      ).flat(),
      ', ',
    );

    const res = (
      await e.getRecords<Record<string, unknown>>(sqltag`
      WITH RECURSIVE
        ${this.withDescendants(ids)}
      SELECT ${selects} FROM childrenBlockIds
        ${join(joinTables, ' ')}
    `)
    ).map((row) => {
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

    return res;
  }

  async getDescendantIds(
    id: string,
    e: IQueryExecuter = this.db,
  ): Promise<{ id: string; type: string }[]> {
    return [];
  }

  async getRootIdByBlockId(id: string, e: IQueryExecuter = this.db) {
    return '';
  }

  async getLinkedBlockTuplesOfBlocksOfRootBlock(
    rootBlockId: string,
    e: IQueryExecuter = this.db,
  ): Promise<Record<string, { blockId: string; type: string }[]>> {
    return {};
  }

  async getLinkedBlocksOfBlocksOfRootBlock(
    rootBlockId: string,
    e: IQueryExecuter = this.db,
  ): Promise<BaseBlockDoc[]> {
    return [];
  }

  async bulkUpdate(
    doc: BaseBlockDoc[],
    ctx: ISyncCtx,
    e: IQueryExecuter = this.db,
  ) {
    console.log();
  }

  async getRootBlockIdsOfLinkedBlocks(
    rootBlockId: string,
    e: IQueryExecuter = this.db,
  ) {
    const linkedBlockIdsToDescendants = sqltag`
      SELECT blockId FROM ${raw(blocksLinksTable)} WHERE linkedToBlockId IN (
        WITH RECURSIVE
          ${this.withDescendants([rootBlockId])}
        SELECT blockId FROM childrenBlockIds
      )
    `;

    const res = await e.getRecords<{ blockId: string; isLinked: 0 | 1 }>(sqltag`
      WITH RECURSIVE
        parentBlockIds(blockId, parentId, isLinked) AS (
          SELECT blockId, parentId, 1 FROM ${raw(
            blocksChildrenTable,
          )} WHERE blockId IN (${linkedBlockIdsToDescendants})
          UNION ALL
          SELECT a.blockId, a.parentId, 0 FROM ${raw(
            blocksChildrenTable,
          )} a JOIN parentBlockIds b ON a.blockId = b.parentId LIMIT 100
        )
      SELECT parentBlockIds.blockId, parentBlockIds.isLinked FROM parentBlockIds WHERE parentBlockIds.parentId IS NULL OR parentBlockIds.isLinked = 1
    `);

    return {
      rootBlockIds: res
        .filter(({ isLinked }) => isLinked === 0)
        .map(({ blockId }) => blockId),
      linkedBlockIds: res
        .filter(({ isLinked }) => isLinked === 1)
        .map(({ blockId }) => blockId),
    };
  }

  async bulkDelete(
    ids: { id: string; type: string }[],
    ctx: ISyncCtx,
    e: IQueryExecuter = this.db,
  ) {}

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
          JOIN ${raw(tableName)} b ON a.parentId = b.blockId LIMIT 1000000
      )
    `;
  }
}
