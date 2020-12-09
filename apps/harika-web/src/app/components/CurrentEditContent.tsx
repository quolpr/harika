import React from 'react';

export type ICurrentEditState =
  | undefined
  | {
      id: string;
      startPositionAt?: number;
    };

export const CurrentEditContext = React.createContext<
  [
    editState: ICurrentEditState,
    setEditState: (state: ICurrentEditState) => void
  ]
>([undefined, () => null]);
