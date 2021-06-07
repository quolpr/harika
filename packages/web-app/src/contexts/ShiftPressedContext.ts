import { createContext, createRef } from 'react';

export const ShiftPressedContext = createContext<React.RefObject<boolean>>(
  createRef(),
);
