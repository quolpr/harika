import { inject, injectable } from 'inversify';
import { Observable } from 'rxjs';
import sql, { raw } from 'sql-template-tag';

import { DB } from '../../../../extensions/DbExtension/DB';
import { DbEventsListenService } from '../../../../extensions/SyncExtension/services/DbEventsListenerService';
import { AllBlocksRepository } from '../repositories/AllBlocksRepository';
import {
  noteBlocksFTSTable,
  noteBlocksTable,
} from '../repositories/NoteBlocksRepostitory';
import {
  textBlocksFTSTable,
  textBlocksTable,
} from '../repositories/TextBlocksRepository';

@injectable()
export class FindNoteOrBlockService {
  constructor(
    @inject(DbEventsListenService)
    private dbEventsService: DbEventsListenService,
    @inject(AllBlocksRepository)
    private allBlocksRepo: AllBlocksRepository,
    @inject(DB) private db: DB, // private notesRepo: SqlNotesRepository, // private notesBlocksRepo: NotesBlocksRepository,
  ) {}

  async find(text: string): Promise<
    {
      blockId: string;
      data: string;
      rootBlockId: string;
      blockType: string;
    }[]
  > {
    // console.log(
    //   await this.allBlocksRepo.getRootBlockIds(['Bi79i43bVyeh0lhT8wra']),
    // );

    text = text.toLowerCase().trim();

    const rows = await this.db.getRecords<{
      blockId: string;
      blockType: string;
      data: string;
    }>(sql`
      SELECT * FROM (
        SELECT
          id blockId,
          'noteBlock' blockType,
          (SELECT title as data FROM ${raw(noteBlocksTable)} WHERE id = ${raw(
      noteBlocksFTSTable,
    )}.id) data,
          bm25(${raw(noteBlocksFTSTable)}) rank
        FROM ${raw(noteBlocksFTSTable)}
        WHERE
          title LIKE ${`%${text}%`}

        UNION

        SELECT
          id blockId,
          'textBlock' blockType,
          (SELECT content as data FROM ${raw(textBlocksTable)} WHERE id = ${raw(
      textBlocksFTSTable,
    )}.id) data,
          bm25(${raw(textBlocksFTSTable)}) rank
        FROM ${raw(textBlocksFTSTable)}
        WHERE
          textContent LIKE ${`%${text}%`}
      )
      ORDER BY
        CASE blockType WHEN 'noteBlock' THEN 0 ELSE 1 END, rank LIMIT 20
    `);

    const rootBlocks =
      rows.length > 0
        ? await this.allBlocksRepo.getRootBlockIds(
            rows.map(({ blockId }) => blockId),
          )
        : {};

    return rows.map((row) => ({
      ...row,
      rootBlockId: rootBlocks[row.blockId],
    }));
  }

  find$(text: string) {
    return this.dbEventsService.liveQuery(this.allBlocksRepo.blocksTables, () =>
      this.find(text),
    );
  }

  async findNotes(text: string): Promise<{ id: string; title: string }[]> {
    text = text.toLowerCase().trim();

    const res = await this.db.getRecords<{
      id: string;
      title: string;
    }>(
      sql`SELECT id, (SELECT title FROM ${raw(
        noteBlocksTable,
      )} WHERE id = ${raw(noteBlocksFTSTable)}.id) AS title FROM ${raw(
        noteBlocksFTSTable,
      )} WHERE title LIKE ${'%' + text + '%'} ORDER BY rank`,
    );

    return res;
  }

  findNotes$(text: string): Observable<{ id: string; title: string }[]> {
    return this.dbEventsService.liveQuery([noteBlocksTable], () =>
      this.findNotes(text),
    );
  }

  async findTextBlocks(
    text: string,
  ): Promise<{ id: string; content: string }[]> {
    text = text.toLowerCase().trim();

    const res = await this.db.getRecords<{
      id: string;
      content: string;
    }>(
      sql`SELECT id, (SELECT content FROM ${raw(
        textBlocksTable,
      )} WHERE id = ${raw(textBlocksFTSTable)}.id) AS content FROM ${raw(
        textBlocksFTSTable,
      )} WHERE textContent LIKE ${'%' + text + '%'} ORDER BY rank`,
    );

    return res;
  }

  findTextBlocks$(text: string) {
    return this.dbEventsService.liveQuery([textBlocksTable], () =>
      this.findTextBlocks(text),
    );
  }
}
