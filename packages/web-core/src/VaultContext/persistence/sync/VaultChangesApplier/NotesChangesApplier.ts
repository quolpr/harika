import type {
  IUpdateChange,
  IDeleteChange,
  IDatabaseChange,
} from '../../../../db-sync/synchronizer/types';
import type { NoteDocType, notesTable } from '../../NotesRepository';
import { BaseChangesApplier } from './BaseChangesApplier';

export class NotesChangesApplier extends BaseChangesApplier<
  typeof notesTable,
  NoteDocType
> {
  protected resolveUpdateUpdate(
    change1: IUpdateChange<typeof notesTable, NoteDocType>,
    _change2: IUpdateChange<typeof notesTable, NoteDocType>,
  ): IUpdateChange<typeof notesTable, NoteDocType> {
    return change1;
  }

  protected resolveUpdateDelete(
    _change1: IUpdateChange<typeof notesTable, NoteDocType>,
    change2: IDeleteChange<typeof notesTable, NoteDocType>,
  ): IDatabaseChange<typeof notesTable, NoteDocType> {
    return change2;
  }
}
