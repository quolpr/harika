import { createContext } from 'react';

export type ICurrentNoteIdState = undefined | string;

export const CurrentNoteIdContext = createContext<
  [
    editState: ICurrentNoteIdState,
    setEditState: (state: ICurrentNoteIdState) => void
  ]
>([undefined, () => null]);
