import { blocksLinksTable } from '../../NoteBlocksExtension/repositories/NotesBlocksRepository';

export const linkedBlockTrigger = (tableName: string) => {
  return `
    CREATE TRIGGER populateNoteBlocksBlocksTable_${tableName}_insert AFTER INSERT ON ${tableName} BEGIN
      DELETE FROM ${blocksLinksTable} WHERE blockId = new.id;
      INSERT INTO ${blocksLinksTable}(linkedToBlockId, blockId) SELECT j.value, new.id FROM json_each(new.linkedBlockIds) AS j;
    END;

    CREATE TRIGGER populateNoteBlocksBlocksTable_${tableName}_deleteBlock AFTER DELETE ON ${tableName} BEGIN
      DELETE FROM ${blocksLinksTable} WHERE blockId = old.id;
    END;

    CREATE TRIGGER populateNoteBlocksBlocksTable_${tableName}_update AFTER UPDATE ON ${tableName} BEGIN
      DELETE FROM ${blocksLinksTable} WHERE blockId = old.id;
      INSERT INTO ${blocksLinksTable}(linkedToBlockId, blockId) SELECT j.value, new.id FROM json_each(new.linkedBlockIds) AS j;
    END;
  `;
};
