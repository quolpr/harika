import { inject, injectable } from 'inversify';
import { NoteBlocksService } from '../../../NoteBlocksExtension/app/services/NoteBlocksService';
import { NotesService } from '../../../NotesExtension/app/services/NotesService';
import type { Optional, Required } from 'utility-types';
import { ModelCreationData } from 'mobx-keystone';
import { NoteModel } from '../../../NotesExtension/app/models/NoteModel';
import { ImportExportService } from '../../worker/services/ImportExportService';
import { toRemoteName } from '../../../../../framework/utils';
import { Remote } from 'comlink';
import { DbEventsListenService } from '../../../../../extensions/SyncExtension/app/services/DbEventsListenerService';
import {
  distinctUntilChanged,
  firstValueFrom,
  from,
  map,
  switchMap,
} from 'rxjs';
import { notesTable } from '../../../NotesExtension/worker/repositories/NotesRepository';
import { FindNoteOrBlockService } from '../../worker/services/FindNoteOrBlockService';
import { noteBlocksTable } from '../../../NoteBlocksExtension/worker/repositories/NotesBlocksRepository';
import { filterAst } from '../../../../../lib/blockParser/astHelpers';
import { isEqual, uniq } from 'lodash-es';
import {
  NoteBlockRef,
  NoteRefToken,
  TagToken,
} from '../../../../../lib/blockParser/types';
import { Dayjs } from 'dayjs';
import { DeleteNoteService } from '../../worker/services/DeleteNoteService';

@injectable()
export class VaultService {
  constructor(
    @inject(NotesService) private notesService: NotesService,
    @inject(DbEventsListenService)
    private dbEventsService: DbEventsListenService,
    @inject(NoteBlocksService) private noteBlocksService: NoteBlocksService,
    @inject(toRemoteName(ImportExportService))
    private importExportService: Remote<ImportExportService>,
    @inject(toRemoteName(FindNoteOrBlockService))
    private findService: Remote<FindNoteOrBlockService>,
    @inject(toRemoteName(DeleteNoteService))
    private deleteNoteService: Remote<DeleteNoteService>,
  ) {}

  async createNote(
    attrs: Required<
      Optional<
        ModelCreationData<NoteModel>,
        'createdAt' | 'updatedAt' | 'dailyNoteDate'
      >,
      'title'
    >,
    options?: { isDaily?: boolean },
  ) {
    const result = await this.notesService.createNote(attrs, options);

    if (result.status === 'ok') {
      this.noteBlocksService.createBlocksTree(result.data.$modelId);

      return {
        status: 'ok' as const,
        data: result.data,
      };
    } else {
      return result;
    }
  }

  async getOrCreateDailyNote(date: Dayjs) {
    const note = await firstValueFrom(this.notesService.getDailyNote$(date));

    if (note) {
      return {
        status: 'ok',
        data: note,
      };
    }

    const title = date.format('D MMM YYYY');
    const startOfDate = date.startOf('day');

    return await this.createNote(
      {
        title,
        dailyNoteDate: startOfDate.toDate().getTime(),
      },
      { isDaily: true },
    );
  }

  findNotesOrBlocks$(content: string) {
    return from(
      this.dbEventsService.liveQuery(
        [notesTable, noteBlocksTable],
        () => this.findService.find(content),
        false,
      ),
    );
  }

  searchNotesTuples$(title: string) {
    return from(
      this.dbEventsService.liveQuery([notesTable], () =>
        this.findService.findNotes(title),
      ),
    );
  }

  searchBlocksTuples$(title: string) {
    return from(
      this.dbEventsService.liveQuery([noteBlocksTable], () =>
        this.findService.findBlocks(title),
      ),
    );
  }

  async import(importData: {
    data: { data: { tableName: string; rows: any[] }[] };
  }) {
    await this.importExportService.importData(importData);
  }

  async export() {
    return await this.importExportService.exportData();
  }

  async updateBlockBlockLinks(noteBlockIds: string[]) {
    return Promise.all(
      noteBlockIds.map(async (id) => {
        const noteBlock = await firstValueFrom(
          this.noteBlocksService.getBlockById$(id),
        );

        if (!noteBlock) {
          console.error('noteBlock note found');
          return;
        }

        console.debug('Updating block block links');

        noteBlock.updateBlockLinks(
          uniq(
            (
              filterAst(
                noteBlock.content.ast,
                (t) => t.type === 'noteBlockRef',
              ) as NoteBlockRef[]
            )
              .map((t) => t.blockId)
              .filter((id) => !!id) as string[],
          ),
        );
      }),
    );
  }

  async updateNoteBlockLinks(noteBlockIds: string[]) {
    return Promise.all(
      noteBlockIds.map(async (id) => {
        const noteBlock = await firstValueFrom(
          this.noteBlocksService.getBlockById$(id),
        );

        if (!noteBlock) {
          console.error('noteBlock note found');
          return;
        }
        console.debug('Updating block note links');

        const titles = uniq(
          (
            filterAst(
              noteBlock.content.ast,
              (t) => t.type === 'noteRef' || t.type === 'tag',
            ) as (NoteRefToken | TagToken)[]
          ).map((t: NoteRefToken | TagToken) => t.ref),
        );

        const existingNotesIndexed = Object.fromEntries(
          (titles.length > 0
            ? await firstValueFrom(this.notesService.getByTitles$(titles))
            : []
          ).map((n) => [n.title, n]),
        );

        const allParsedLinkedNotes = (
          await Promise.all(
            titles.map(async (name) => {
              if (!existingNotesIndexed[name]) {
                const result = await this.createNote(
                  { title: name },
                  { isDaily: false },
                );

                if (result.status === 'ok') {
                  return result.data;
                } else {
                  alert(JSON.stringify(result.errors));
                }
              } else {
                const existing = existingNotesIndexed[name];

                return this.notesService.getNote(existing.$modelId);
              }
            }),
          )
        ).flatMap((n) => (n ? [n] : []));

        noteBlock.updateNoteLinks(
          allParsedLinkedNotes.map(({ $modelId }) => $modelId),
        );
      }),
    );
  }

  getLinksOfNote$(noteId: string) {
    const links$ = this.noteBlocksService
      .getLinksOfNoteId$(noteId)
      .pipe(distinctUntilChanged((a, b) => isEqual(a, b)));

    return links$.pipe(
      switchMap((links) => {
        return this.notesService.findNoteByIds$(Object.keys(links)).pipe(
          map((notes) =>
            notes.map((note) => ({
              note,
              linkedBlockIds: links[note.$modelId],
            })),
          ),
        );
      }),
    );
  }

  async updateNoteTitle(noteId: string, newTitle: string) {
    const exists = await this.notesService.isNoteExists(newTitle);

    if (exists) return 'exists' as const;

    const note = await this.notesService.getNote(noteId);

    if (!note) return;

    const oldTitle = note.title;

    (
      await firstValueFrom(
        this.getLinksOfNote$(noteId)
          .pipe(map((links) => links.map(({ note: { $modelId } }) => $modelId)))
          .pipe(
            switchMap((ids) =>
              this.noteBlocksService.getBlocksRegistryByNoteIds$(ids),
            ),
          ),
      )
    )
      .flatMap((holder) => holder.getLinkedBlocksOfNoteId(noteId))
      .map((block) => block.content.updateTitle(oldTitle, newTitle));

    note.updateTitle(newTitle);

    return 'ok';
  }

  async deleteNote(id: string) {
    await this.deleteNoteService.deleteNote(id);
  }
}
