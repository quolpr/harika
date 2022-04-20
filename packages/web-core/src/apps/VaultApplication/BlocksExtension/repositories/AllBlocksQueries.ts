import 'reflect-metadata';

import { injectable } from 'inversify';
import sql, { join, raw } from 'sql-template-tag';

import { blocksChildrenTable } from './AllBlocksRepository';

@injectable()
export class AllBlocksQueries {
  getDescendantBlockIds(ids: string[], tableName = 'childrenBlockIds') {
    const rawBlocksChildrenTable = raw(blocksChildrenTable);

    return sql`
      ${raw(tableName)}(blockId, parentId) AS (
        VALUES ${join(
          ids.map((id) => sql`(${id}, NULL)`),
          ',',
        )}
        UNION ALL
        SELECT a.blockId, a.parentId FROM ${rawBlocksChildrenTable} a 
          JOIN ${raw(tableName)} b ON a.parentId = b.blockId LIMIT 10000000
      )
    `;
  }
}
