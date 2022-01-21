import { DB } from '../../../../extensions/DbExtension/DB';
import { inject, injectable } from 'inversify';

@injectable()
export class FindNoteOrBlockService {
  constructor(
    @inject(DB) private db: DB, // private notesRepo: SqlNotesRepository, // private notesBlocksRepo: NotesBlocksRepository,
  ) {}

  find(text: string) {
    // text = text.toLowerCase().trim();

    // const res = this.db.getRecords<{
    //   noteId: string;
    //   noteBlockId: string | null;
    //   tableType: typeof noteBlocksTable | typeof noteBlocksTable;
    //   data: string;
    // }>(
    //   // Only in nested selects order will work
    //   Q.select()
    //     .from(
    //       Q.select()
    //         .from(
    //           Q.select(
    //             'NULL as noteBlockId',
    //             `'${noteBlocksTable}' tableType`,
    //             Q.select('title')
    //               .as('data')
    //               .from(noteBlocksTable)
    //               .where(Q(`id = ${noteBlocksFTSTable}.id`)),
    //             'id noteId',
    //             `bm25(${noteBlocksFTSTable}) rank`,
    //           )
    //             .from(noteBlocksFTSTable)
    //             .where(Q.like('title', `%${text}%`)),
    //         )
    //         .union(
    //           Q.select().from(
    //             Q.select(
    //               'id noteBlockId',
    //               `'${noteBlocksTable}' tableType`,
    //               Q.select('content')
    //                 .as('data')
    //                 .from(noteBlocksTable)
    //                 .where(Q(`id = ${noteBlocksFTSTable}.id`)),
    //               Q.select('noteId')
    //                 .as('noteId')
    //                 .from(noteBlocksTable)
    //                 .where(Q(`id = ${noteBlocksFTSTable}.id`)),
    //               `bm25(${noteBlocksFTSTable}) rank`,
    //             )
    //               .from(noteBlocksFTSTable)
    //               .where(Q.like('textContent', `%${text}%`)),
    //           ),
    //         ),
    //     )
    //     .orderBy(
    //       `CASE tableType WHEN '${noteBlocksTable}' THEN 0 ELSE 1 END, rank LIMIT 20`,
    //     ),
    // );

    return [];
  }

  // findNotes(text: string) {
  //   text = text.toLowerCase().trim();

  //   const res = this.db.getRecords<{
  //     id: string;
  //     title: string;
  //   }>(
  //     Q.select(
  //       'id',
  //       Q.select('title')
  //         .as('title')
  //         .from(noteBlocksTable)
  //         .where(Q(`id = ${noteBlocksFTSTable}.id`)),
  //     )
  //       .from(noteBlocksFTSTable)
  //       .where(Q.like('title', `%${text}%`))
  //       .orderBy('rank'),
  //   );

  //   return res;
  // }

  // findBlocks(text: string) {
  //   text = text.toLowerCase().trim();

  //   const res = this.db.getRecords<{
  //     id: string;
  //     content: string;
  //   }>(
  //     Q.select(
  //       'id',
  //       Q.select('content')
  //         .as('content')
  //         .from(noteBlocksTable)
  //         .where(Q(`id = ${noteBlocksFTSTable}.id`)),
  //     )
  //       .from(noteBlocksFTSTable)
  //       .where(Q.like('textContent', `%${text}%`))
  //       .orderBy('rank'),
  //   );

  //   return res;
  // }
}
