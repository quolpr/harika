import { createContext, createRef, MutableRefObject } from 'react';

export const CurrentBlockInputRefContext = createContext<
  MutableRefObject<HTMLTextAreaElement | null>
>(createRef());
