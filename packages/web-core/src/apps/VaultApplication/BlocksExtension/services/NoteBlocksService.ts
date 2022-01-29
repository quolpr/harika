import { inject, injectable } from 'inversify';
import { ModelCreationData, withoutUndo } from 'mobx-keystone';
import type { Required } from 'utility-types';
import { Optional } from 'utility-types';
import { DbEventsListenService } from '../../../../extensions/SyncExtension/services/DbEventsListenerService';
import dayjs, { Dayjs } from 'dayjs';
import {
  distinctUntilChanged,
  firstValueFrom,
  from,
  interval,
  map,
  Observable,
  of,
  switchMap,
} from 'rxjs';
import { isEqual } from 'lodash-es';
import { ICreationResult } from '../../../../framework/types';
import {
  NoteBlockDoc,
  NoteBlocksRepository,
  noteBlocksTable,
} from '../repositories/NoteBlocksRepostitory';
import { BlocksStore } from '../models/BlocksStore';
import { noteBlockMapper } from '../mappers/noteBlockMapper';
import { NoteBlock } from '../models/NoteBlock';
import { createNote } from '../models/noteBlockActions';
import { BaseBlock } from '../models/BaseBlock';

@injectable()
export class NoteBlocksService {
  constructor(
    @inject(DbEventsListenService)
    private dbEventsService: DbEventsListenService,
    @inject(NoteBlocksRepository)
    private noteBlocksRepository: NoteBlocksRepository,
    @inject(BlocksStore)
    private blocksStore: BlocksStore,
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
    const note = await firstValueFrom(this.getDailyNote$(date));

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
      this.dbEventsService.liveQuery([noteBlocksTable], () =>
        this.noteBlocksRepository.getDailyNote(date.unix()),
      ),
    ).pipe(switchMap((row) => (row ? this.getNote(row.id) : of(undefined))));
  }

  getNote$(id: string) {
    return from(
      this.dbEventsService.liveQuery([noteBlocksTable], () => this.getNote(id)),
    );
  }

  findNoteByIds$(ids: string[]): Observable<NoteBlock[]> {
    return this.dbEventsService
      .liveQuery([noteBlocksTable], async () => {
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
      })
      .pipe(distinctUntilChanged((a, b) => isEqual(a, b)));
  }

  async getNote(id: string) {
    if (this.blocksStore.getBlockById(id)) {
      return this.blocksStore.getBlockById(id) as NoteBlock;
    } else {
      const noteDoc = await this.noteBlocksRepository.getById(id);

      if (!noteDoc) {
        console.error(`Note with id ${id} not found`);

        return;
      }

      withoutUndo(() => {
        this.blocksStore.handleModelChanges(
          [
            {
              klass: NoteBlock,
              datas: [
                {
                  ...noteBlockMapper.mapToModelData(noteDoc),
                  areChildrenLoaded: false,
                },
              ],
            },
          ],

          [],
        );
      });

      console.debug(`Loading Note#${id} from DB`);

      return this.blocksStore.getBlockById(id) as NoteBlock;
    }
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

  getByTitles$(titles: string[]) {
    return from(
      this.dbEventsService.liveQuery([noteBlocksTable], () =>
        this.noteBlocksRepository.getByTitles(titles),
      ),
    ).pipe(
      map((rows): NoteBlock[] => {
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
      }),
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

  getNoteIdByBlockId$(blockId: string): undefined | string {
    return undefined;
  }

  async isNoteExists(title: string) {
    return !!(await this.noteBlocksRepository.findBy({ title }));
  }

  async getTuplesWithoutDailyNotes() {
    return this.noteBlocksRepository.getTuplesWithoutDailyNotes();
  }

  getLinkedBlocksOfBlockDescendants$(
    rootBlockId: string,
  ): Observable<{ note: NoteBlock; blocks: BaseBlock[] }[]> {
    return of([]);
  }
}