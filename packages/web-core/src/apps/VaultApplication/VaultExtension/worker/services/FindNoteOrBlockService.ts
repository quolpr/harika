import { DB } from '../../../../../extensions/DbExtension/DB';
import type { IInternalSyncCtx } from '../../../../../extensions/SyncExtension/worker/syncCtx';
import Q from 'sql-bricks';
import {
  notesFTSTable,
  notesTable,
} from '../../../NotesExtension/worker/repositories/NotesRepository';
import {
  noteBlocksFTSTable,
  noteBlocksTable,
} from '../../../NoteBlocksExtension/worker/repositories/NotesBlocksRepository';
import { inject, injectable } from 'inversify';
import { remotable } from '../../../../../framework/utils';

@remotable('FindNoteOrBlockService')
@injectable()
export class FindNoteOrBlockService {
  constructor(
    @inject(DB) private db: DB<IInternalSyncCtx>, // private notesRepo: SqlNotesRepository, // private notesBlocksRepo: NotesBlocksRepository,
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

  findNotes(text: string) {
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

  findBlocks(text: string) {
    text = text.toLowerCase().trim();

    const res = this.db.getRecords<{
      id: string;
      content: string;
    }>(
      Q.select(
        'id',
        Q.select('content')
          .as('content')
          .from(noteBlocksTable)
          .where(Q(`id = ${noteBlocksFTSTable}.id`)),
      )
        .from(noteBlocksFTSTable)
        .where(Q.like('textContent', `%${text}%`))
        .orderBy('rank'),
    );

    return res;
  }
}
