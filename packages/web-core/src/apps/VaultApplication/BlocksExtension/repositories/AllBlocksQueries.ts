import { join, raw, sqltag } from '../../../../lib/sql';
import { blocksChildrenTable } from './AllBlocksRepository';

export class AllBlocksQueries {
  getDescendantBlockIds(ids: string[], tableName = 'childrenBlockIds') {
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
