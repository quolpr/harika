import { Dayjs } from 'dayjs';
import Dexie from 'dexie';
import 'dexie-observable';
import 'dexie-syncable';
import { generateId } from '../../generateId';

export type NoteDocType = {
  syncId: string;
  shortId: string;
  title: string;
  dailyNoteDate: number;
  rootBlockId: string;
  createdAt: number;
  updatedAt?: number;
};

export type NoteBlockDocType = {
  syncId: string;
  shortId: string;
  parentBlockId?: string;
  noteId: string;
  noteBlockIds: string[];
  linkedNoteIds: string[];
  content: string;
  createdAt: number;
  updatedAt?: number;
};

const windowId = generateId();

export class VaultDexieDatabase extends Dexie {
  notes: Dexie.Table<NoteDocType, string>;
  noteBlocks: Dexie.Table<NoteBlockDocType, string>;

  constructor(id: string) {
    super(`harika_vault_${id}`);

    this.version(1).stores({
      noteBlocks:
        '$$syncId, &shortId, parentBlockId, noteId, *noteBlockIds, *linkedNoteIds, content, createdAt, updatedAt',
      notes:
        '$$syncId, &shortId, rootBlockId, title, dailyNoteDate, createdAt, updatedAt',
    });

    this.noteBlocks = this.table('noteBlocks');
    this.notes = this.table('notes');
  }

  get noteBlocksQueries() {
    return new NoteBlocksQueries(this);
  }

  get notesQueries() {
    return new NotesQueries(this);
  }

  get windowId() {
    return windowId;
  }
}

class NoteBlocksQueries {
  table: Dexie.Table<NoteBlockDocType, string>;

  constructor(private db: VaultDexieDatabase) {
    this.table = db.noteBlocks;
  }

  getById(id: string) {
    return this.table.where('shortId').equals(id).first();
  }

  getByIds(ids: string[]) {
    return this.table.where('shortId').anyOf(ids).toArray();
  }

  getByNoteId(id: string) {
    return this.table.where('noteId').equals(id).toArray();
  }

  getLinkedBlocksOfNoteId(id: string) {
    return this.table.where({ linkedNoteIds: id }).toArray();
  }
}

class NotesQueries {
  table: Dexie.Table<NoteDocType, string>;

  constructor(private db: VaultDexieDatabase) {
    this.table = db.notes;
  }

  async getDailyNote(date: Dayjs) {
    const startOfDate = date.startOf('day');

    const dbNotes = await this.table
      .where({
        dailyNoteDate: startOfDate.unix() * 1000,
      })
      .toArray();

    if (dbNotes.length > 0) {
      if (dbNotes.length > 1) {
        console.error(`Daily notes for ${startOfDate} is more then one!!`);
      }

      return dbNotes[0];
    } else {
      return;
    }
  }

  async getByIds(ids: string[]) {
    return this.table.where('shortId').anyOf(ids).toArray();
  }

  async getById(id: string) {
    return this.table.where('shortId').equals(id).first();
  }

  async getByTitles(titles: string[]) {
    return this.table.where('title').anyOf(titles).toArray();
  }

  async all() {
    return this.table.toArray();
  }

  async searchNotes(title: string) {
    return this.table.where('title').startsWithIgnoreCase(title).toArray();
  }

  async getIsNoteExists(title: string) {
    return (await this.getByTitles([title])).length !== 0;
  }

  // TODO: maybe could be optimized
  async getNotesOfNoteBlockIds(noteBlockIds: string[]) {
    const noteIds = (
      await this.db.noteBlocksQueries.getByIds(noteBlockIds)
    ).map(({ noteId }) => noteId);

    return this.getByIds(noteIds);
  }

  // TODO: maybe could be optimized
  async getLinkedNotesOfNoteId(id: string) {
    return this.getByIds(
      (await this.db.noteBlocksQueries.getLinkedBlocksOfNoteId(id)).map(
        ({ noteId }) => noteId
      )
    );
  }
}
