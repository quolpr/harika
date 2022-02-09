import dayjs, { Dayjs } from 'dayjs';
import { inject, injectable } from 'inversify';
import { ModelCreationData, withoutUndo } from 'mobx-keystone';
import {
  distinctUntilChanged,
  from,
  interval,
  map,
  Observable,
  of,
  switchMap,
} from 'rxjs';
import type { Required } from 'utility-types';
import { Optional } from 'utility-types';

import { DbEventsListenService } from '../../../../extensions/SyncExtension/services/DbEventsListenerService';
import { ICreationResult } from '../../../../framework/types';
import { noteBlockMapper } from '../mappers/noteBlockMapper';
import { BaseBlock } from '../models/BaseBlock';
import { BlocksStore } from '../models/BlocksStore';
import { NoteBlock } from '../models/NoteBlock';
import { createNote } from '../models/noteBlockActions';
import {
  NoteBlockDoc,
  NoteBlocksRepository,
  noteBlocksTable,
} from '../repositories/NoteBlocksRepostitory';
import { AllBlocksService } from './AllBlocksService';

@injectable()
export class NoteBlocksService {
  constructor(
    @inject(DbEventsListenService)
    private dbEventsService: DbEventsListenService,
    @inject(NoteBlocksRepository)
    private noteBlocksRepository: NoteBlocksRepository,
    @inject(BlocksStore)
    private blocksStore: BlocksStore,
    @inject(AllBlocksService)
    private allBlocksService: AllBlocksService,
  ) {}

  async createNote(
    attrs: Required<
      Optional<
        ModelCreationData<NoteBlock>,
        'createdAt' | 'updatedAt' | 'dailyNoteDate' | 'orderPosition'
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
      } as ICreationResult<NoteBlock>;
    }

    if (await this.noteBlocksRepository.getIsExistsByTitle(attrs.title)) {
      return {
        status: 'error',
        errors: { title: ['Already exists'] },
      } as ICreationResult<NoteBlock>;
    }

    const note = createNote(this.blocksStore, attrs, options);

    return {
      status: 'ok',
      data: note,
    } as ICreationResult<NoteBlock>;
  }

  async getOrCreateDailyNote(date: Dayjs) {
    const note = await this.getDailyNote(date);

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

  async getDailyNote(date: Dayjs) {
    const doc = await this.noteBlocksRepository.getDailyNote(date.unix());

    if (doc) {
      return this.getNote(doc.id);
    }

    return undefined;
  }

  async findNoteByIds(ids: string[]): Promise<NoteBlock[]> {
    const toLoadIds = ids.filter(
      (id) => !Boolean(this.blocksStore.hasBlockWithId(id)),
    );

    const noteDocs =
      toLoadIds.length !== 0
        ? await this.noteBlocksRepository.getByIds(toLoadIds)
        : [];

    withoutUndo(() => {
      this.blocksStore.handleModelChanges(
        [
          {
            klass: NoteBlock,
            datas: noteDocs.map((doc) => ({
              ...noteBlockMapper.mapToModelData(doc),
              areChildrenLoaded: false,
            })),
          },
        ],
        [],
      );
    });

    return ids
      .map((id) => this.blocksStore.getBlockById(id) as NoteBlock)
      .filter((v) => Boolean(v));
  }

  async getNote(id: string) {
    const note = await this.allBlocksService.getBlockWithTreeById(id);

    if (!(note instanceof NoteBlock)) {
      console.error(`Note with id ${id} not found, but ${note} found`);

      return;
    }

    return note;
  }

  async getByTitles(titles: string[]) {
    const rows = await this.noteBlocksRepository.getByTitles(titles);

    return rows.map((row) => {
      withoutUndo(() => {
        this.blocksStore.handleModelChanges(
          [
            {
              klass: NoteBlock,
              datas: [
                {
                  ...noteBlockMapper.mapToModelData(row),
                  areChildrenLoaded: false,
                },
              ],
            },
          ],
          [],
        );
      });

      console.debug(`Loading Note#${row.id} from DB`);

      return this.blocksStore.getBlockById(row.id) as NoteBlock;
    });
  }

  async getTuplesWithoutDailyNotes() {
    return this.noteBlocksRepository.getTuplesWithoutDailyNotes();
  }

  async isNoteExists(title: string) {
    return !!(await this.noteBlocksRepository.findBy({ title }));
  }

  getTodayDailyNote$() {
    return interval(1000).pipe(
      map(() => dayjs().startOf('day')),
      distinctUntilChanged((a, b) => a.unix() === b.unix()),
      switchMap((date) =>
        this.dbEventsService.liveQuery([noteBlocksTable], () =>
          this.getDailyNote(date),
        ),
      ),
      distinctUntilChanged(),
    );
  }

  getAllNotesTuples$() {
    return from(
      this.dbEventsService.liveQuery([noteBlocksTable], () =>
        this.noteBlocksRepository.getAll(),
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
  getNoteIdByTitle$(title: string) {
    return from(
      this.dbEventsService.liveQuery([noteBlocksTable], () =>
        this.noteBlocksRepository.getByTitles([title]),
      ) as Observable<NoteBlockDoc[]>,
    ).pipe(
      map((docs) => docs[0]?.id),
      distinctUntilChanged(),
    );
  }
}
