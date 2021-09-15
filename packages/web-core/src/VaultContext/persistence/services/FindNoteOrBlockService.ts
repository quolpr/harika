import type { DB } from '../../../db/DB';
import type { IInternalSyncCtx } from '../../../db-sync/persistence/syncCtx';
import { notesTable } from '../NotesRepository';
import {
  noteBlocksFTSTable,
  noteBlocksTable,
  notesFTSTable,
} from '../NotesBlocksRepository';
import Q from 'sql-bricks';

export class FindNoteOrBlockService {
  constructor(
    private db: DB<IInternalSyncCtx>, // private notesRepo: SqlNotesRepository, // private notesBlocksRepo: SqlNotesBlocksRepository,
  ) {}

  find(text: string) {
    text = text.toLowerCase().trim();

    const res = this.db.getRecords<{
      noteId: string;
      noteBlockId: string | null;
      tableType: typeof notesTable | typeof noteBlocksTable;
      data: string;
    }>(
      // Only in nested selects order will work
      Q.select()
        .from(
          Q.select()
            .from(
              Q.select(
                'NULL as noteBlockId',
                `'${notesTable}' tableType`,
                Q.select('title')
                  .as('data')
                  .from(notesTable)
                  .where(Q(`id = ${notesFTSTable}.id`)),
                'id noteId',
                `bm25(${notesFTSTable}) rank`,
              )
                .from(notesFTSTable)
                .where(Q.like('title', `%${text}%`)),
            )
            .union(
              Q.select().from(
                Q.select(
                  'id noteBlockId',
                  `'${noteBlocksTable}' tableType`,
                  Q.select('content')
                    .as('data')
                    .from(noteBlocksTable)
                    .where(Q(`id = ${noteBlocksFTSTable}.id`)),
                  Q.select('noteId')
                    .as('noteId')
                    .from(noteBlocksTable)
                    .where(Q(`id = ${noteBlocksFTSTable}.id`)),
                  `bm25(${noteBlocksFTSTable}) rank`,
                )
                  .from(noteBlocksFTSTable)
                  // @ts-ignore
                  .where(Q.like('textContent', `%${text}%`)),
              ),
            ),
        )
        .orderBy(`CASE tableType WHEN '${notesTable}' THEN 0 ELSE 1 END, rank`),
    );

    return res;
  }

  findNote(text: string) {
    text = text.toLowerCase().trim();

    const res = this.db.getRecords<{
      id: string;
      title: string;
    }>(
      Q.select(
        'id',
        Q.select('title')
          .as('title')
          .from(notesTable)
          .where(Q(`id = ${notesFTSTable}.id`)),
      )
        .from(notesFTSTable)
        .where(Q.like('title', `%${text}%`))
        .orderBy('rank'),
    );

    return res;
  }
}
