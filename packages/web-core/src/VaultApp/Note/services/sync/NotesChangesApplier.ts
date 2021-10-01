import type {
  IUpdateChange,
  IDeleteChange,
  IDatabaseChange,
} from '../../../../db/sync/synchronizer/types';
import type { NoteDoc, notesTable } from '../../../NotesTree/repositories/NotesRepository';
import { BaseChangesApplier } from '../../../services/sync/VaultChangesApplier/BaseChangesApplier';

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
}
