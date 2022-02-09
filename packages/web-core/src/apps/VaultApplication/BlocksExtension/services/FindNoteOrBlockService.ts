import { inject, injectable } from 'inversify';
import { Observable, of } from 'rxjs';
import Q from 'sql-bricks';

import { DB } from '../../../../extensions/DbExtension/DB';
import { DbEventsListenService } from '../../../../extensions/SyncExtension/services/DbEventsListenerService';
import { raw, sqltag } from '../../../../lib/sql';
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
    }>(sqltag`
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
      Q.select(
        'id',
        Q.select('title')
          .as('title')
          .from(noteBlocksTable)
          .where(Q(`id = ${noteBlocksFTSTable}.id`)),
      )
        .from(noteBlocksFTSTable)
        .where(Q.like('title', `%${text}%`))
        .orderBy('rank'),
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
      Q.select(
        'id',
        Q.select('content')
          .as('content')
          .from(textBlocksTable)
          .where(Q(`id = ${textBlocksFTSTable}.id`)),
      )
        .from(textBlocksFTSTable)
        .where(Q.like('textContent', `%${text}%`))
        .orderBy('rank'),
    );

    return res;
  }

  findTextBlocks$(text: string) {
    return this.dbEventsService.liveQuery([textBlocksTable], () =>
      this.findTextBlocks(text),
    );
  }
}
