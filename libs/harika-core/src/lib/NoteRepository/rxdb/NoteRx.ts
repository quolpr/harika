import { Dayjs } from 'dayjs';
import { RxJsonSchema, RxCollection, RxDocument } from 'rxdb';
import { HarikaDatabaseCollections } from './collectionTypes';
import { NoteBlockDocument } from './NoteBlockDb';
import { NoteLinkDocument } from './NoteLinkRx';

export type NoteDocType = {
  _id: string;
  title: string;
  dailyNoteDate: number;
  rootBlockRef: string;
  createdAt: number;
  updatedAt?: number;
};

export const schema: RxJsonSchema<NoteDocType> = {
  title: 'hero schema',
  description: 'describes a note',
  version: 0,
  type: 'object',
  properties: {
    _id: {
      type: 'string',
      primary: true,
    },
    rootBlockRef: {
      type: 'string',
      ref: HarikaDatabaseCollections.NOTE_BLOCKS,
    },
    title: {
      type: 'string',
    },
    dailyNoteDate: {
      type: 'integer',
    },
    createdAt: {
      type: 'integer',
    },
    updatedAt: {
      type: 'integer',
    },
  },
  required: ['title', 'dailyNoteDate', 'rootBlockRef'],
  indexes: ['_id', 'title', 'dailyNoteDate'],
};

type CollectionMethods = {
  getDailyNote(date: Dayjs): Promise<NoteDocument | undefined>;
  getNoteById(id: string): Promise<NoteDocument | null>;
  getByTitles(titles: string[]): Promise<NoteDocument[]>;
  getAllNotes(): Promise<NoteDocument[]>;
  searchNotes(title: string): Promise<NoteDocument[]>;
  getIsNoteExists(title: string): Promise<boolean>;
  getNotesOfNoteBlockIds(noteBlockIds: string[]): Promise<NoteDocument[]>;
};

export const collectionMethods: CollectionMethods = {
  async getDailyNote(this: NoteCollection, date: Dayjs) {
    const startOfDate = date.startOf('day');

    const dbNotes = await this.find({
      selector: { dailyNoteDate: startOfDate.unix() * 1000 },
    }).exec();

    if (dbNotes.length > 0) {
      if (dbNotes.length > 1) {
        console.error(`Daily notes for ${startOfDate} is more then one!!`);
      }

      return dbNotes[0];
    } else {
      return;
    }
  },
  async getNoteById(this: NoteCollection, id: string) {
    return this.findOne({ selector: { _id: id } }).exec();
  },
  async getByTitles(this: NoteCollection, titles: string[]) {
    return this.find({ selector: { title: { $in: titles } } }).exec();
  },
  async getAllNotes(this: NoteCollection) {
    return this.find().exec();
  },
  async searchNotes(this: NoteCollection, title: string) {
    return this.find({
      selector: { title: title },
    }).exec();
  },
  async getIsNoteExists(this: NoteCollection, title: string) {
    return (await this.getByTitles([title])).length !== 0;
  },
  async getNotesOfNoteBlockIds(this: NoteCollection, noteBlockIds: string[]) {
    const noteIds = Array.from(
      (await this.database.noteblocks.findByIds(noteBlockIds)).values()
    ).map(({ noteId }) => noteId);

    return Array.from((await this.database.notes.findByIds(noteIds)).values());
  },
};

type DocumentMethods = {
  getNoteBlocks(): Promise<NoteBlockDocument[]>;
  getLinks(): Promise<NoteLinkDocument[]>;
};

export const documentMethods: DocumentMethods = {
  async getNoteBlocks(this: NoteDocument) {
    return this.collection.database.noteblocks
      .find({
        selector: { noteRef: this._id },
      })
      .exec();
  },
  async getLinks(this: NoteDocument) {
    return this.collection.database.notelinks
      .find({
        selector: { noteRef: this._id },
      })
      .exec();
  },
};

export type NoteCollection = RxCollection<
  NoteDocType,
  DocumentMethods,
  CollectionMethods
>;
export type NoteDocument = RxDocument<NoteDocType, DocumentMethods>;

export const dbNotesCollection = {
  schema,
  methods: documentMethods,
  statics: collectionMethods,
};
