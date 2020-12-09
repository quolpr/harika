import { createContext } from 'use-context-selector';

export type ICurrentEditState =
  | undefined
  | {
      id: string;
      startPositionAt?: number;
    };

export const CurrentEditContext = createContext<
  [
    editState: ICurrentEditState,
    setEditState: (state: ICurrentEditState) => void
  ]
>([undefined, () => null]);
