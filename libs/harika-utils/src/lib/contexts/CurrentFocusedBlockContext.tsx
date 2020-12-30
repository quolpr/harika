import { NoteBlockModel } from '@harika/harika-core';
import { createContext } from 'use-context-selector';

export type ICurrentFocusedBlockState =
  | undefined
  | {
      noteBlock: NoteBlockModel;
      startPositionAt?: number;
    };

export const CurrentFocusedBlockContext = createContext<
  [
    editState: ICurrentFocusedBlockState,
    setEditState: (state: ICurrentFocusedBlockState) => void
  ]
>([undefined, () => null]);
