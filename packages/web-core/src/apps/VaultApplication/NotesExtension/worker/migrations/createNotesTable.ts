import { DB } from '../../../../../extensions/DbExtension/DB';
import { IMigration } from '../../../../../extensions/DbExtension/types';
import { notesFTSTable, notesTable } from '../repositories/NotesRepository';

const up = (db: DB<any>) => {
  db.sqlExec(`
    CREATE TABLE IF NOT EXISTS ${notesTable} (
      id varchar(20) PRIMARY KEY,
      title varchar(255) NOT NULL,
      dailyNoteDate INTEGER,
      updatedAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notes_title ON ${notesTable}(title);
    CREATE INDEX IF NOT EXISTS idx_notes_date ON ${notesTable}(dailyNoteDate);
  `);

  db.sqlExec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS ${notesFTSTable} USING fts5(id UNINDEXED, title, tokenize="trigram");
  `);
};

export const initNotesTable: IMigration = {
  up,
  id: 1632733297840, // just take current UTC time, with `new Date().getTime()`
  name: 'createNotesTable',
};
