import { createContext } from 'use-context-selector';

export type ICurrentFocusedBlockState =
  | undefined
  | {
      id: string;
      startPositionAt?: number;
    };

export const CurrentFocusedBlockContext = createContext<
  [
    editState: ICurrentFocusedBlockState,
    setEditState: (state: ICurrentFocusedBlockState) => void
  ]
>([undefined, () => null]);
