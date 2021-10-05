import { inject, injectable } from 'inversify';
import { ModelCreationData, withoutUndo } from 'mobx-keystone';
import { Optional } from 'utility-types';
import { ICreationResult } from '../../../../apps/VaultApp/types';
import { DbEventsService } from '../../../../extensions/SyncExtension/DbEventsService';
import type { Required } from 'utility-types';
import { NoteModel } from '../models/NoteModel';
import { NotesRepository, notesTable } from '../repositories/NotesRepository';
import { Remote } from 'comlink';
import { toRemoteName } from '../../../../framework/utils';
import { NotesStore } from '../models/NotesStore';
import { generateId } from '../../../../lib/generateId';
import dayjs, { Dayjs } from 'dayjs';
import { interval, map, distinctUntilChanged, switchMap, from, of } from 'rxjs';
import { convertNoteDocToModelAttrs } from '../converters/toModels';

@injectable()
export class NotesService {
  constructor(
    @inject(DbEventsService) private dbEventsService: DbEventsService,
    @inject(toRemoteName(NotesRepository))
    private notesRepository: Remote<NotesRepository>,
    @inject(NotesStore)
    private notesStore: NotesStore,
  ) {}

  async createNote(
    attrs: Required<
      Optional<
        ModelCreationData<NoteModel>,
        'createdAt' | 'updatedAt' | 'dailyNoteDate' | 'rootBlockId'
      >,
      'title'
    >,
    options?: { isDaily?: boolean },
  ) {
    options = { isDaily: false, ...options };

    if (attrs.title.trim().length === 0) {
      return {
        status: 'error',
        errors: { title: ["Can't be empty"] },
      } as ICreationResult<NoteModel>;
    }

    if (await this.notesRepository.getIsExistsByTitle(attrs.title)) {
      return {
        status: 'error',
        errors: { title: ['Already exists'] },
      } as ICreationResult<NoteModel>;
    }

    const note = new NoteModel({
      $modelId: generateId(),
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
      rootBlockId: generateId(),
      ...(options.isDaily
        ? {
            dailyNoteDate: dayjs().startOf('day').unix(),
          }
        : {}),
      ...attrs,
    });

    this.notesStore.registerNote(note);

    return {
      status: 'ok',
      data: note,
    } as ICreationResult<NoteModel>;
  }

  getTodayDailyNote$() {
    return interval(1000).pipe(
      map(() => dayjs().startOf('day')),
      distinctUntilChanged((a, b) => a.unix() === b.unix()),
      switchMap((date) => this.getDailyNote$(date)),
      distinctUntilChanged(),
    );
  }

  getDailyNote$(date: Dayjs) {
    return from(
      this.dbEventsService.liveQuery([notesTable], () =>
        this.notesRepository.getDailyNote(date.unix()),
      ),
    ).pipe(switchMap((row) => (row ? this.getNote(row.id) : of(undefined))));
  }

  getNote$(id: string) {
    return from(
      this.dbEventsService.liveQuery([notesTable], () => this.getNote(id)),
    );
  }

  async getNote(id: string) {
    if (this.notesStore.getNote(id)) {
      return this.notesStore.getNote(id);
    } else {
      const noteDoc = await this.notesRepository.getById(id);

      if (!noteDoc) {
        console.error(`Note with id ${id} not found`);

        return;
      }

      withoutUndo(() => {
        this.notesStore.createOrUpdateNotes([
          convertNoteDocToModelAttrs(noteDoc),
        ]);
      });

      console.debug(`Loading Note#${id} from DB`);

      return this.notesStore.getNote(id);
    }
  }
}
