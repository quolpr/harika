import React from 'react';
import { TableName } from '../../model/schema';

export type ICurrentEditState =
  | undefined
  | {
      id: string;
      type: TableName;
    };

export const CurrentEditContext = React.createContext<
  [
    editState: ICurrentEditState,
    setEditState: (state: ICurrentEditState) => void
  ]
>([undefined, () => null]);
