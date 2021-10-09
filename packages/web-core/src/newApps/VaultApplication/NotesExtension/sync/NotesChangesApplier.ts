import type {
  IUpdateChange,
  IDeleteChange,
  IDatabaseChange,
} from '../../../../extensions/SyncExtension/serverSynchronizer/types';
import { NoteDoc, notesTable } from '../../../../apps/VaultApp/NotesApp/repositories/NotesRepository';
import { BaseChangesApplier } from '../../../../extensions/SyncExtension/BaseChangesApplier';

export class NotesChangesApplier extends BaseChangesApplier<
  typeof notesTable,
  NoteDoc
> {
  protected resolveUpdateUpdate(
    change1: IUpdateChange<typeof notesTable, NoteDoc>,
    _change2: IUpdateChange<typeof notesTable, NoteDoc>,
  ): IUpdateChange<typeof notesTable, NoteDoc> {
    return change1;
  }

  protected resolveUpdateDelete(
    _change1: IUpdateChange<typeof notesTable, NoteDoc>,
    change2: IDeleteChange<typeof notesTable, NoteDoc>,
  ): IDatabaseChange<typeof notesTable, NoteDoc> {
    return change2;
  }

  get tableName() {
    return notesTable;
  }
}
