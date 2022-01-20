import { blocksChildrenTable } from '../repositories/AllBlocksRepository';

export const childrenBlocksTrigger = (tableName: string) => {
  return `
    CREATE TRIGGER populateBlocksBlocksTable_${tableName}_insert AFTER INSERT ON ${tableName} BEGIN
      DELETE FROM ${blocksChildrenTable} WHERE blockId = new.id;
      INSERT INTO ${blocksChildrenTable}(childId, blockId) new.id, new.parentId;
    END;

    CREATE TRIGGER populateBlocksBlocksTable_${tableName}_deleteBlock AFTER DELETE ON ${tableName} BEGIN
      DELETE FROM ${blocksChildrenTable} WHERE childId = old.id;
    END;

    CREATE TRIGGER populateBlocksBlocksTable_${tableName}_update AFTER UPDATE ON ${tableName} BEGIN
      DELETE FROM ${blocksChildrenTable} WHERE childId = old.id;
      INSERT INTO ${blocksChildrenTable}(childId, blockId) new.id, new.parentId;
    END;
  `;
};
