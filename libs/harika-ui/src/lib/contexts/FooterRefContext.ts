import { createContext } from 'react';

export const FooterRefContext = createContext<React.RefObject<
  HTMLDivElement
> | null>(null);
