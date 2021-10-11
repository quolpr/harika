import { isEqual } from 'lodash-es';
import { useObservable, useObservableState } from 'observable-hooks';
import React, { useCallback, useMemo } from 'react';
import { switchMap } from 'rxjs';
import {
  Context,
  createContext,
  useContextSelector,
} from 'use-context-selector';
import { useNoteBlocksService } from '../hooks/vaultAppHooks';

const LinkedBlocksOfBlocksContext = createContext<
  undefined | Record<string, { noteId: string; blockId: string }[]>
>(undefined);

export const useDeepContextSelector = <T extends any, R extends any>(
  ctx: Context<T>,
  selector: (val: T) => R,
) => {
  const patchedSelector = useMemo(() => {
    let prevValue: R | null = null;

    return (state: T) => {
      const nextValue: R = selector(state);

      if (prevValue && isEqual(prevValue, nextValue)) {
        return prevValue;
      }

      prevValue = nextValue;

      return nextValue;
    };
  }, [selector]);

  return useContextSelector(ctx, patchedSelector);
};

export const LinkedBlocksOfBlocksProvider: React.FC<{
  noteId: string;
}> = ({ noteId, children }) => {
  const noteBlocksService = useNoteBlocksService();

  const links$ = useObservable(
    (inputs$) => {
      return inputs$.pipe(
        switchMap(([noteBlocksService, noteId]) => {
          return noteBlocksService.getLinkedBlocksOfBlocksOfNote$(noteId);
        }),
      );
    },
    [noteBlocksService, noteId],
  );

  const links = useObservableState(links$, {});

  console.log({ links });

  return (
    <LinkedBlocksOfBlocksContext.Provider value={links}>
      {children}
    </LinkedBlocksOfBlocksContext.Provider>
  );
};

export const useBacklinkedBlocks = (blockId: string) => {
  return useDeepContextSelector(
    LinkedBlocksOfBlocksContext,
    useCallback(
      (val) => {
        if (!val) {
          console.error('LinkedBlocksOfBlocksContext is not set!');
          return [];
        }

        return val[blockId] || [];
      },
      [blockId],
    ),
  );
};

export const useBacklinkedBlocksCount = (blockId: string) => {
  return useDeepContextSelector(
    LinkedBlocksOfBlocksContext,
    useCallback(
      (val) => {
        if (!val) return 0;

        return val[blockId]?.length || 0;
      },
      [blockId],
    ),
  );
};
