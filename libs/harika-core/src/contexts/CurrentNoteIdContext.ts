import { NoteModel } from '@harika/harika-notes';
import { createContext } from 'react';

export type ICurrentNoteState = undefined | NoteModel;

export const CurrentNoteContext = createContext<
  [
    editState: ICurrentNoteState,
    setEditState: (state: ICurrentNoteState) => void
  ]
>([undefined, () => null]);
