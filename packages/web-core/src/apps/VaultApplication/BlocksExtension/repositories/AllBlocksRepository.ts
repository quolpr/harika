import { DB, IQueryExecuter } from '../../../../extensions/DbExtension/DB';
import { inject } from 'inversify';
import { BaseBlockRepository } from './BaseBlockRepository';
import sql, { join, raw } from 'sql-template-tag';

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

export class AllBlocksRepository {
  constructor(
    @inject(DB) private db: DB,
    private blocksRepos: BaseBlockRepository[],
  ) {}

  async getDescendants(ids: string[], e: IQueryExecuter = this.db) {
    const joinTables = this.blocksRepos
      .map((r) => r.getTableName())
      .map(
        (tableName) =>
          sql`LEFT JOIN ${raw(tableName)} ON ${raw(
            tableName,
          )}.id = childrenBlockIds.blockId`,
      );

    // TODO: converts with toDoc
    return await e.getRecords<BaseBlockRow>(sql`
      WITH RECURSIVE
        ${this.withDescendants(ids)}
      SELECT * FROM childrenBlockIds
        ${join(joinTables, ' ')}
    `);
  }

  // async getLinkedBlocksOfBlockId(
  //   id: string,
  //   e: IQueryExecuter,
  // ): Promise<BaseBlockDoc[]> {
  //   return (
  //     (
  //       await e.getRecords<BaseBlockRow>(
  //         Q.select(`joined.*`)
  //           .from(noteBlocksNotesTable)
  //           .leftJoin(`${this.getTableName()} joined`, {
  //             [`${noteBlocksNotesTable}.noteBlockId`]: `joined.id`,
  //           })
  //           .where({ [`${noteBlocksNotesTable}.noteId`]: id }),
  //       )
  //     )?.map((res) => this.toDoc(res)) || []
  //   );
  // }

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

  private withDescendants(ids: string[]) {
    const rawBlocksChildrenTable = raw(blocksChildrenTable);
    return sql`
      childrenBlockIds(blockId, parentId) AS (
        VALUES ${join(
          ids.map((id) => sql`(${id})`),
          ',',
        )}
        UNION ALL
        SELECT a.blockId, a.parentId FROM ${rawBlocksChildrenTable} a 
          JOIN ${rawBlocksChildrenTable} b ON a.parentId = b.blockId LIMIT 1000000
      )
    `;
  }
}
