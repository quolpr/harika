import {
  model,
  Model,
  modelAction,
  modelFlow,
  ModelInstanceCreationData,
  prop,
  _async,
  _await,
} from 'mobx-keystone';
import { Database, DatabaseAdapter } from '@nozbe/watermelondb';
import { Queries } from './Vault/db/Queries';
import { convertNoteRowToModelAttrs } from './Vault/convertRowToModel';
import { Dayjs } from 'dayjs';
import { ChangesHandler } from './Vault/ChangesHandler';
import { NoteBlockModel, noteBlockRef } from './Vault/models/NoteBlockModel';
import { Syncher } from './Vault/sync';
import { NoteModel, noteRef } from './Vault/models/NoteModel';
import { Optional } from 'utility-types';
import { v4 as uuidv4 } from 'uuid';
import { NoteRow } from './Vault/db/rows/NoteRow';
import { NoteBlockRow } from './Vault/db/rows/NoteBlockRow';
import { schema } from './Vault/db/schema';
import { syncMiddleware } from './Vault/models/syncable';
import { NoteLinkRow } from './Vault/db/rows/NoteLinkRow';
import { NoteLinkModel } from './Vault/models/NoteLinkModel';
import { BlocksViewModel } from './Vault/models/BlocksViewModel';
import { Required } from 'utility-types';
import { ICreationResult } from './Vault/types';

export { NoteModel } from './Vault/models/NoteModel';
export { NoteLinkModel } from './Vault/models/NoteLinkModel';
export { BlocksViewModel } from './Vault/models/BlocksViewModel';
export { NoteBlockModel, noteBlockRef } from './Vault/models/NoteBlockModel';

export interface IAdapterBuilder {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (opts: { dbName: string; schema: any }): DatabaseAdapter;
}

// ROW = DB projection of the model
// Model = DDD model
// Tuple = plain object data, used for fast data getting

const modelType = 'harika/Vault';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isVault = (model: any): model is Vault =>
  '$modelType' in model && model.$modelType === modelType;

export function initializeVault(
  id: string,
  name: string,
  buildAdapter: IAdapterBuilder
) {
  const database = new Database({
    adapter: buildAdapter({ dbName: `vault-${id}`, schema: schema }),
    modelClasses: [NoteRow, NoteBlockRow, NoteLinkRow],
    actionsEnabled: true,
  });

  console.log(database);

  @model(modelType)
  class Vault extends Model({
    name: prop<string>(),
    notesMap: prop<Record<string, NoteModel>>(() => ({})),
    blocksMap: prop<Record<string, NoteBlockModel>>(() => ({})),
    blocksViewsMap: prop<Record<string, BlocksViewModel>>(() => ({})),
    // TODO: could be optimize with Record
    noteLinks: prop<NoteLinkModel[]>(() => []),
  }) {
    private database = database;
    private queries = new Queries(this.database);
    private syncer!: Syncher;

    onInit() {
      this.syncer = new Syncher(database, this, this.queries);

      syncMiddleware(
        this,
        new ChangesHandler(database, this.queries, this, this.syncer)
          .handlePatch
      );
    }

    @modelAction
    getOrCreateViewByModel(model: { $modelId: string; $modelType: string }) {
      const key = `${model.$modelType}-${model.$modelId}`;

      if (this.blocksViewsMap[key]) return this.blocksViewsMap[key];

      this.blocksViewsMap[key] = new BlocksViewModel({});

      return this.blocksViewsMap[key];
    }

    @modelAction
    createLink(note: NoteModel, noteBlock: NoteBlockModel) {
      const link = new NoteLinkModel({
        $modelId: uuidv4(),
        noteRef: noteRef(note),
        noteBlockRef: noteBlockRef(noteBlock),
        createdAt: new Date(),
      });

      this.noteLinks.push(link);

      return link;
    }

    @modelAction
    unlink(note: NoteModel, noteBlock: NoteBlockModel) {
      const link = this.noteLinks.find(
        (link) =>
          link.noteBlockRef.id === noteBlock.$modelId &&
          link.noteRef.id === note.$modelId
      );

      if (!link) return;

      link.markAsDeleted();

      this.noteLinks.splice(this.noteLinks.indexOf(link), 1);
    }

    @modelFlow
    createNote = _async(function* (
      this: Vault,
      attrs: Required<
        Optional<
          ModelInstanceCreationData<NoteModel>,
          'createdAt' | 'dailyNoteDate'
        >,
        'title'
      >
    ) {
      if (attrs.title.trim().length === 0) {
        return {
          status: 'error',
          errors: { title: ["Can't be empty"] },
        } as ICreationResult<NoteModel>;
      }

      if (yield* _await(this.queries.getIsNoteExists(attrs.title))) {
        return {
          status: 'error',
          errors: { title: ['Already exists'] },
        } as ICreationResult<NoteModel>;
      }

      const note = new NoteModel({
        $modelId: uuidv4(),
        createdAt: new Date(),
        dailyNoteDate: new Date(),
        areLinksLoaded: true,
        areChildrenLoaded: true,
        ...attrs,
      });

      this.notesMap[note.$modelId] = note;

      note.createBlock({ content: '', orderPosition: 0 });

      return { status: 'ok', data: note } as ICreationResult<NoteModel>;
    });

    @modelFlow
    getOrCreateDailyNote = _async(function* (this: Vault, date: Dayjs) {
      const noteRow = yield* _await(this.queries.getDailyNoteRow(date));

      if (noteRow) {
        return {
          status: 'ok',
          data: yield* _await(this.findNote(noteRow.id)),
        } as ICreationResult<NoteModel>;
      }

      const title = date.format('D MMM YYYY');
      const startOfDate = date.startOf('day');

      return yield* _await(
        this.createNote({
          title,
          dailyNoteDate: startOfDate.toDate(),
        })
      );
    });

    async sync() {
      return true;
      // return this.syncer.sync();
    }

    async findNote(id: string, preloadChildren = true, preloadLinks = true) {
      if (this.notesMap[id]) {
        const noteInStore = this.notesMap[id];

        if (
          !(preloadChildren && !noteInStore.areChildrenLoaded) &&
          !(preloadLinks && !noteInStore.areLinksLoaded)
        )
          return noteInStore;
      }

      return this.preloadNote(id, preloadChildren, preloadLinks);
    }

    async updateNoteBlockLinks(noteBlock: NoteBlockModel) {
      const names = [...noteBlock.content.matchAll(/\[\[(.+?)\]\]/g)].map(
        ([, name]) => name
      );

      const existingNotesIndexed = Object.fromEntries(
        (await this.queries.getNoteRowsByNames(names)).map((n) => [n.title, n])
      );

      const allNotes = (
        await Promise.all(
          names.map(async (name) => {
            if (!existingNotesIndexed[name]) {
              const result = await this.createNote({ title: name });

              if (result.status === 'ok') {
                return result.data;
              } else {
                alert(JSON.stringify(result.errors));
              }
            } else {
              const existing = existingNotesIndexed[name];

              return this.findNote(existing.id, false);
            }
          })
        )
      ).flatMap((n) => (n ? [n] : []));

      const allNotesIndexed = Object.fromEntries(
        allNotes.map((n) => [n.$modelId, n])
      );

      const existingLinkedNotesIndexed = Object.fromEntries(
        noteBlock.noteLinks.map((link) => [
          link.noteRef.id,
          link.noteRef.current,
        ])
      );

      allNotes.forEach((note) => {
        if (!existingLinkedNotesIndexed[note.$modelId]) {
          this.createLink(note, noteBlock);
        }
      });

      Object.values(existingLinkedNotesIndexed).forEach((note) => {
        if (!allNotesIndexed[note.$modelId]) {
          this.unlink(note, noteBlock);
        }
      });
    }

    async preloadNote(id: string, preloadChildren = true, preloadLinks = true) {
      const row = await this.queries.getNoteRowById(id);
      const data = await convertNoteRowToModelAttrs(
        this.queries,
        row,
        preloadChildren,
        preloadLinks
      );

      this.createOrUpdateEntitiesFromAttrs(
        [data.note, ...data.linkedNotes.map(({ note }) => note)],
        [
          ...data.noteBlocks,
          ...data.linkedNotes.flatMap(({ noteBlocks }) => noteBlocks),
        ],
        [
          ...data.noteLinks,
          ...data.linkedNotes.flatMap(({ noteLinks }) => noteLinks),
        ]
      );

      return this.notesMap[row.id];
    }

    @modelAction
    private createOrUpdateEntitiesFromAttrs(
      noteAttrs: (ModelInstanceCreationData<NoteModel> & {
        $modelId: string;
      })[],
      blocksAttrs: (ModelInstanceCreationData<NoteBlockModel> & {
        $modelId: string;
      })[],
      noteLinksAttrs: (ModelInstanceCreationData<NoteLinkModel> & {
        $modelId: string;
      })[]
    ) {
      const notes = noteAttrs.map((note) => {
        if (this.notesMap[note.$modelId]) {
          this.notesMap[note.$modelId].updateAttrs(note);
        } else {
          this.notesMap[note.$modelId] = new NoteModel(note);
        }

        return this.notesMap[note.$modelId];
      });

      const blocks = blocksAttrs.map((block) => {
        if (this.blocksMap[block.$modelId]) {
          this.blocksMap[block.$modelId].updateAttrs(block);
        } else {
          this.blocksMap[block.$modelId] = new NoteBlockModel(block);
        }

        return this.blocksMap[block.$modelId];
      });

      const noteLinks = noteLinksAttrs.map((link) => {
        let linkInStore = this.noteLinks.find(
          ({ $modelId }) => $modelId === link.$modelId
        );

        if (!linkInStore) {
          linkInStore = new NoteLinkModel(link);

          this.noteLinks.push(linkInStore);
        }

        return linkInStore;
      });

      return { notes, blocks, noteLinks };
    }

    async searchNotesTuples(title: string) {
      return (await this.queries.searchNotes(title)).map((row) => ({
        id: row.id,
        title: row.title,
      }));
    }

    async getAllNotesTuples() {
      return (await this.queries.getAllNotes()).map((row) => ({
        id: row.id,
        title: row.title,
        createdAt: row.createdAt,
      }));
    }
  }

  return new Vault({ $modelId: id, name });
}

export type Vault = ReturnType<typeof initializeVault>;
