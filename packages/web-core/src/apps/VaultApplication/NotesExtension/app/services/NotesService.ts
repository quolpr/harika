import { inject, injectable } from 'inversify';
import { ModelCreationData, withoutUndo } from 'mobx-keystone';
import { Optional } from 'utility-types';
import { DbEventsListenService } from '../../../../../extensions/SyncExtension/app/services/DbEventsListenerService';
import type { Required } from 'utility-types';
import { NoteModel } from '../models/NoteModel';
import {
  NoteDoc,
  NotesRepository,
  notesTable,
} from '../../worker/repositories/NotesRepository';
import { NotesStore } from '../models/NotesStore';
import { generateId } from '../../../../../lib/generateId';
import dayjs, { Dayjs } from 'dayjs';
import {
  interval,
  map,
  distinctUntilChanged,
  switchMap,
  from,
  of,
  Observable,
} from 'rxjs';
import { notesMapper } from '../mappers/notesMapper';
import { isEqual } from 'lodash-es';
import { ICreationResult } from '../../../../../framework/types';

@injectable()
export class NotesService {
  constructor(
    @inject(DbEventsListenService)
    private dbEventsService: DbEventsListenService,
    @inject(NotesRepository)
    private notesRepository: NotesRepository,
    @inject(NotesStore)
    private notesStore: NotesStore,
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
      ...(options.isDaily
        ? {
            dailyNoteDate: dayjs().startOf('day').unix(),
          }
        : {}),
      ...attrs,
    });

    withoutUndo(() => {
      this.notesStore.registerNote(note);
    });

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

  findNoteByIds$(ids: string[]) {
    // TODO: load only not loaded
    return this.dbEventsService
      .liveQuery([notesTable], async () => {
        const toLoadIds = ids.filter(
          (id) => !Boolean(this.notesStore.notesMap[id]),
        );

        const noteDocs =
          toLoadIds.length !== 0
            ? await this.notesRepository.getByIds(toLoadIds)
            : [];

        withoutUndo(() => {
          this.notesStore.handleChanges(
            noteDocs.map((doc) => notesMapper.mapToModelData(doc)),
            [],
          );
        });

        return ids
          .map((id) => this.notesStore.notesMap[id])
          .filter((v) => Boolean(v));
      })
      .pipe(distinctUntilChanged((a, b) => isEqual(a, b)));
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
        this.notesStore.handleChanges(
          [notesMapper.mapToModelData(noteDoc)],
          [],
        );
      });

      console.debug(`Loading Note#${id} from DB`);

      return this.notesStore.getNote(id);
    }
  }

  getAllNotesTuples$() {
    return from(
      this.dbEventsService.liveQuery([notesTable], () =>
        this.notesRepository.getAll(),
      ),
    ).pipe(
      map((rows) =>
        rows.map((row) => ({
          id: row.id,
          title: row.title,
          createdAt: new Date(row.createdAt),
        })),
      ),
    );
  }

  getByTitles$(titles: string[]) {
    return from(
      this.dbEventsService.liveQuery([notesTable], () =>
        this.notesRepository.getByTitles(titles),
      ),
    ).pipe(
      map((rows): NoteModel[] => {
        return rows.map((row) => {
          withoutUndo(() => {
            this.notesStore.handleChanges(
              [notesMapper.mapToModelData(row)],
              [],
            );
          });

          console.debug(`Loading Note#${row.id} from DB`);

          return this.notesStore.getNote(row.id);
        });
      }),
    );
  }

  getNoteIdByTitle$(title: string) {
    return from(
      this.dbEventsService.liveQuery([notesTable], () =>
        this.notesRepository.getByTitles([title]),
      ) as Observable<NoteDoc[]>,
    ).pipe(
      map((docs) => docs[0]?.id),
      distinctUntilChanged(),
    );
  }

  async isNoteExists(title: string) {
    if (
      Object.values(this.notesStore.notesMap).find(
        (note) => note.title === title,
      )
    )
      return true;

    return !!(await this.notesRepository.findBy({ title }));
  }

  async getTuplesWithoutDailyNotes() {
    return this.notesRepository.getTuplesWithoutDailyNotes();
  }
}
