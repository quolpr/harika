import { Dayjs } from 'dayjs';
import { RxJsonSchema, RxCollection, RxDocument } from 'rxdb';
import { VaultDatabaseCollections } from './collectionTypes';
import { NoteBlockDocument } from './NoteBlockDoc';

export type NoteDocType = {
  _id: string;
  title: string;
  dailyNoteDate: number;
  rootBlockId: string;
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
    rootBlockId: {
      type: 'string',
      ref: VaultDatabaseCollections.NOTE_BLOCKS,
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
  required: ['title', 'dailyNoteDate', 'rootBlockId'],
  indexes: ['_id', 'title', 'dailyNoteDate'],
};

type CollectionMethods = {
  getDailyNote(date: Dayjs): Promise<NoteDocument | undefined>;
  getNoteById(id: string): Promise<NoteDocument | null>;
  getByTitles(titles: string[]): Promise<NoteDocument[]>;
  getByIds(ids: string[]): Promise<NoteDocument[]>;
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
  async getByIds(this: NoteCollection, ids: string[]) {
    return Array.from((await this.findByIds(ids)).values());
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
    const noteIds = (await this.database.noteblocks.getByIds(noteBlockIds)).map(
      ({ noteId }: NoteBlockDocument) => noteId
    );

    return this.getByIds(noteIds);
  },
};

type DocumentMethods = {
  getNoteBlocks(): Promise<NoteBlockDocument[]>;
  getLinkedBlocks(): Promise<NoteBlockDocument[]>;
  getLinkedNotes(): Promise<NoteDocument[]>;
};

export const documentMethods: DocumentMethods = {
  async getNoteBlocks(this: NoteDocument) {
    return this.collection.database.noteblocks
      .find({
        selector: { noteId: this._id },
      })
      .exec();
  },
  async getLinkedBlocks(this: NoteDocument) {
    return this.collection.database.noteblocks
      .find({
        selector: { linkedNoteIds: this._id },
      })
      .exec();
  },

  async getLinkedNotes(this: NoteDocument) {
    return await this.collection.getByIds(
      (await this.getLinkedBlocks()).map(({ noteId }) => noteId)
    );
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