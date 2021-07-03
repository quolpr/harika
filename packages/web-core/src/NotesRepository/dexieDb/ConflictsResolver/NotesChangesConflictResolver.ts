import type {
  IDatabaseChange,
  IDeleteChange,
  IUpdateChange,
  NoteDocType,
} from '@harika/common';
import { BaseConflictResolver } from './BaseConflictResolver';

export class NotesChangesConflictResolver extends BaseConflictResolver<
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
