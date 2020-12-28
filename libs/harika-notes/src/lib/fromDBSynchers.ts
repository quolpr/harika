import { Queries } from './db/Queries';
import { NoteBlockModel } from './models/NoteBlockModel';
import { NoteModel } from './models/NoteModel';

export class NoteBlockFromDBSyncher {
  constructor(private queries: Queries) {}

  addToSync(noteBlock: NoteBlockModel) {}
}

export class NoteModelFromDBSyncher {
  constructor(private queries: Queries) {}

  addToSync(note: NoteModel) {}
}
