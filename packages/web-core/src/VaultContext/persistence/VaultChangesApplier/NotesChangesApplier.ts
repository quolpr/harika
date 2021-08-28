import type {
  IDatabaseChange,
  IDeleteChange,
  IUpdateChange,
  NoteDocType,
} from '../../../dexieTypes';
import { BaseChangesApplier } from './BaseChangesApplier';

export class NotesChangesApplier extends BaseChangesApplier<
  'notes',
  NoteDocType
> {
  protected resolveUpdateUpdate(
    change1: IUpdateChange<'notes', NoteDocType>,
    _change2: IUpdateChange<'notes', NoteDocType>,
  ): IUpdateChange<'notes', NoteDocType> {
    return change1;
  }

  protected resolveUpdateDelete(
    _change1: IUpdateChange<'notes', NoteDocType>,
    change2: IDeleteChange<'notes', NoteDocType>,
  ): IDatabaseChange<'notes', NoteDocType> {
    return change2;
  }
}
