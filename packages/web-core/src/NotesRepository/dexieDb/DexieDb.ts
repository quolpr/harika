import type { Dayjs } from 'dayjs';
import Dexie from 'dexie';
import 'dexie-observable';
import 'dexie-syncable';
import { generateId } from '@harika/common';
import type { Observable } from 'rxjs';
import { onDexieChange } from '../../dexieHelpers/onDexieChange';
import type { NoteDocType, NoteBlockDocType } from '@harika/common';

const windowId = generateId();

export class VaultDexieDatabase extends Dexie {
  notes: Dexie.Table<NoteDocType, string>;
  noteBlocks: Dexie.Table<NoteBlockDocType, string>;

  notesChange$: Observable<void>;
  noteBlocksChange$: Observable<void>;

  constructor(public id: string) {
    super(`harika_vault_${id}`);

    this.version(1).stores({
      noteBlocks:
        '$$id, parentBlockId, noteId, *noteBlockIds, *linkedNoteIds, content, createdAt, updatedAt',
      notes: '$$id, rootBlockId, title, dailyNoteDate, createdAt, updatedAt',
    });
    this.version(2).stores({
      noteBlocks:
        '$$id, parentBlockId, noteId, *noteBlockIds, *linkedNoteIds, content, createdAt, updatedAt',
      notes:
        '$$id, rootBlockId, title, dailyNoteDate, createdAt, updatedAt, [title+id]',
    });

    this.version(3).stores({
      _syncStatus: '',
      _changesToSend: '++rev',
    });

    this.noteBlocks = this.table('noteBlocks');
    this.notes = this.table('notes');

    this.notesChange$ = onDexieChange(this, 'notes');
    this.noteBlocksChange$ = onDexieChange(this, 'noteBlocks');
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
    return this.table.get({ id });
  }

  async getByIds(ids: string[]) {
    return (await this.table.bulkGet(ids)).filter(
      (v) => !!v,
    ) as NoteBlockDocType[];
  }

  getByParentIds(ids: string[]) {
    return this.table.where('parentBlockId').anyOf(ids).toArray();
  }

  getByNoteId(id: string) {
    return this.table.where('noteId').equals(id).toArray();
  }

  getLinkedBlocksOfNoteId(id: string) {
    return this.table.where({ linkedNoteIds: id }).toArray();
  }

  getLinkedBlocksOfNoteIds(ids: string[]) {
    return this.table.where('linkedNoteIds').anyOf(ids).toArray();
  }

  async getByNoteIds(ids: string[]): Promise<NoteBlockDocType[]> {
    return this.table.where('noteId').anyOf(ids).toArray();
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

  async getByIds(ids: string[]): Promise<NoteDocType[]> {
    return (await this.table.bulkGet(ids)).filter((v) => !!v) as NoteDocType[];
  }

  async getById(id: string) {
    return this.table.get({ id });
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
        ({ noteId }) => noteId,
      ),
    );
  }
}
