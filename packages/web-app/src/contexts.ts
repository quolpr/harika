import { createContext, createRef, MutableRefObject } from 'react';
import { Subject } from 'rxjs';

export const CurrentBlockInputRefContext = createContext<
  MutableRefObject<HTMLTextAreaElement | null>
>(createRef());

export const LoadingDoneSubjectContext = createContext<Subject<void>>(
  new Subject(),
);
