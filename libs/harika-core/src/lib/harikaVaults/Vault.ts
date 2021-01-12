import {
  actionTrackingMiddleware,
  connectReduxDevTools,
  model,
  Model,
  modelAction,
  ModelInstanceCreationData,
  onPatches,
  prop,
  registerRootStore,
  _Model,
} from 'mobx-keystone';
import { Database, DatabaseAdapter } from '@nozbe/watermelondb';
import { Queries } from './db/Queries';
import * as remotedev from 'remotedev';
import { convertNoteRowToModelAttrs } from './convertRowToModel';
import { Dayjs } from 'dayjs';
import { ChangesHandler } from './ChangesHandler';
import { NoteBlockModel, noteBlockRef } from './models/NoteBlockModel';
import { Syncher } from './sync';
import { NoteModel, noteRef } from './models/NoteModel';
import { computed } from 'mobx';
import { Optional } from 'utility-types';
import { v4 as uuidv4 } from 'uuid';
import { NoteRow } from './db/rows/NoteRow';
import { NoteBlockRow } from './db/rows/NoteBlockRow';
import { schema } from './db/schema';
import { syncMiddleware } from './models/syncable';
import { NoteLinkRow } from './db/rows/NoteLinkRow';
import { NoteLinkModel } from './models/NoteLinkModel';
import { BlocksViewModel } from './models/BlocksViewModel';

export { NoteModel } from './models/NoteModel';
export { NoteLinkModel } from './models/NoteLinkModel';
export { NoteBlockModel, noteBlockRef } from './models/NoteBlockModel';

export interface IAdapterBuilder {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (opts: { dbName: string; schema: any }): DatabaseAdapter;
}

export function createVault(id: string, buildAdapter: IAdapterBuilder) {
  const database = new Database({
    adapter: buildAdapter({ dbName: `vault-${id}`, schema: schema }),
    modelClasses: [NoteRow, NoteBlockRow, NoteLinkRow],
    actionsEnabled: true,
  });

  @model('harika/Vault')
  class Vault extends Model({
    notesMap: prop<Record<string, NoteModel>>(() => ({})),
    blocksMap: prop<Record<string, NoteBlockModel>>(() => ({})),
    blocksViewsMap: prop<Record<string, BlocksViewModel>>(() => ({})),
    // TODO: could be optimize with Record
    noteLinks: prop<NoteLinkModel[]>(() => []),
  }) {
    private database = database;
    private queries = new Queries(this.database);
    private syncer!: Syncher;
    private areAllNotesLoaded = false;

    onInit() {
      this.syncer = new Syncher(database, this, this.queries);

      syncMiddleware(
        this,
        new ChangesHandler(database, this.queries, this, this.syncer)
          .handlePatch
      );
    }

    @computed({ keepAlive: true })
    get allNotes() {
      return Object.values(this.notesMap);
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

    @modelAction
    createNote(
      attrs: Optional<
        ModelInstanceCreationData<NoteModel>,
        'createdAt' | 'dailyNoteDate'
      >
    ) {
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

      return note;
    }

    @modelAction
    async getOrCreateDailyNote(date: Dayjs) {
      const noteRow = await this.queries.getDailyNoteRow(date);

      if (noteRow) {
        return this.findNote(noteRow.id);
      }

      const title = date.format('D MMM YYYY');
      const startOfDate = date.startOf('day');

      return this.createNote({
        title,
        dailyNoteDate: startOfDate.toDate(),
      });
    }

    async sync() {
      return this.syncer.sync();
    }

    async preloadAllNotes() {
      if (this.areAllNotesLoaded) return;

      // TODO: optimize
      const allNotes = await this.queries.getAllNotes();
      await Promise.all(
        allNotes.map(async (note) => {
          await this.findNote(note.id, false, false);
        })
      );
      this.areAllNotesLoaded = true;
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

      const allNotes = await Promise.all(
        names.map(async (name) => {
          if (!existingNotesIndexed[name]) {
            const newNote = this.createNote({ title: name });

            return newNote;
          } else {
            const existing = existingNotesIndexed[name];

            return this.findNote(existing.id, false);
          }
        })
      );

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

    async searchNotes(title: string) {
      return (await this.queries.searchNotes(title)).map((row) => ({
        id: row.id,
        title: row.title,
      }));
    }
  }

  const vault = new Vault({ $modelId: id });

  const connection = remotedev.connectViaExtension({
    name: 'Harika vault',
  });

  connectReduxDevTools(remotedev, connection, vault);

  registerRootStore(vault);

  return vault;
}

export type Vault = ReturnType<typeof createVault>;
