import { blocksChildrenTable } from '../repositories/AllBlocksRepository';

export const childrenBlocksTrigger = (tableName: string) => {
  return `
    CREATE TRIGGER populateBlocksBlocksTable_${tableName}_insert AFTER INSERT ON ${tableName} BEGIN
      DELETE FROM ${blocksChildrenTable} WHERE blockId = new.id;
      INSERT INTO ${blocksChildrenTable}(blockId, parentId) VALUES(new.id, new.parentId);
    END;

    CREATE TRIGGER populateBlocksBlocksTable_${tableName}_deleteBlock AFTER DELETE ON ${tableName} BEGIN
      DELETE FROM ${blocksChildrenTable} WHERE blockId = old.id;
    END;

    CREATE TRIGGER populateBlocksBlocksTable_${tableName}_update AFTER UPDATE ON ${tableName} BEGIN
      DELETE FROM ${blocksChildrenTable} WHERE blockId = old.id;
      INSERT INTO ${blocksChildrenTable}(blockId, parentId) VALUES(new.id, new.parentId);
    END;
  `;
};
