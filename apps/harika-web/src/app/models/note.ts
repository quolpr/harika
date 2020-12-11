import { Dayjs } from 'dayjs';
import { RxJsonSchema, RxCollection, RxDocument, RxQuery } from 'rxdb';
import { HarikaDatabaseDocuments } from '../HarikaDatabaseDocuments';
import { HarikaDatabase } from '../initDb';
import {
  createBlockNote,
  NoteBlockCollection,
  NoteBlockDocType,
  NoteBlockDocument,
} from './noteBlocks';

type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export type NoteDocType = {
  _id: string;
  title: string;
  dailyNoteDate: number;
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
    title: {
      type: 'string',
    },
    dailyNoteDate: {
      type: 'integer',
    },
  },
  required: ['title', 'dailyNoteDate'],
};

type DocMethods = {
  updateTitle(title: string): Promise<void>;
  childNoteBlocks(): RxQuery<NoteBlockDocType, NoteBlockDocument[]>;
};

export const docMethods: DocMethods = {
  async updateTitle(this: NoteDocument, title: string) {
    await this.atomicPatch({
      title,
    });
  },

  childNoteBlocks(this: NoteDocument) {
    const noteBlocks = this.collection.database[
      HarikaDatabaseDocuments.NOTE_BLOCKS
    ] as NoteBlockCollection;

    return noteBlocks.find({
      selector: { noteId: this._id },
    });
  },
};

export type NoteCollection = RxCollection<NoteDocType>;
export type NoteDocument = RxDocument<NoteDocType, DocMethods>;

export const createNote = async (
  database: HarikaDatabase,
  fields: Optional<NoteDocType, '_id'>
) => {
  const newNote = await database.notes.insert(fields);

  await createBlockNote(database, {
    parentBlockId: null,
    noteId: newNote._id,
    content: '',
    order: 0,
  });
};

export const getOrCreateDailyNote = async (
  database: HarikaDatabase,
  date: Dayjs
) => {
  const title = date.format('D MMM YYYY');
  const startOfDate = date.startOf('day');

  const note = await database.notes
    .findOne({
      selector: {
        dailyNoteDate: startOfDate.unix(),
      },
    })
    .exec();

  if (note) {
    return note;
  } else {
    return createNote(database, {
      title,
      dailyNoteDate: startOfDate.unix(),
    });
  }
};

export const dbNotesCollection = {
  schema,
  methods: docMethods,
};
