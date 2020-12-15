import { NoteMemModel } from '@harika/harika-notes';
import { createContext } from 'react';

export type ICurrentNoteState = undefined | NoteMemModel;

export const CurrentNoteContext = createContext<
  [
    editState: ICurrentNoteState,
    setEditState: (state: ICurrentNoteState) => void
  ]
>([undefined, () => null]);
