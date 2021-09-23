import { createContext, createRef, MutableRefObject } from 'react';

// This context will contain the element that will wrap all the content of the page. It is used to correctly position autocomplete popovers, so they will not overflow
export const ContainerElRefContext = createContext<
  MutableRefObject<HTMLDivElement | null>
>(createRef());
