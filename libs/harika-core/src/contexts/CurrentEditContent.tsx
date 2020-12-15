import { NoteBlockModel } from '@harika/harika-notes';
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
