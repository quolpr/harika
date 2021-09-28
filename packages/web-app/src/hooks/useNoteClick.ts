import type { Vault } from '@harika/web-core';
import queryString from 'query-string';
import { useCallback } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { paths } from '../paths';

export const generateStackedNotePath = (
  currentSearch: string,
  vaultModelId: string,
  currentNoteId: string,
  nextNoteId: string,
) => {
  const parsedCurrentQuery = queryString.parse(currentSearch);

  const path = paths.vaultNotePath({
    vaultId: vaultModelId,
    noteId: nextNoteId,
  });

  const newQuery = {
    stackedIds: [
      ...(parsedCurrentQuery.stackedIds ? [parsedCurrentQuery.stackedIds] : [])
        .flat()
        .filter((id) => id !== currentNoteId),
      currentNoteId,
    ].filter((id) => id !== nextNoteId),
  };

  return `${path}?${queryString.stringify(newQuery)}`;
};

export const useHandleClick = (
  vault: Vault,
  currentNoteId: string | undefined,
  nextNoteId: string | undefined,
  forceStackOpen = false,
) => {
  const location = useLocation();
  const history = useHistory();

  return useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      if (!currentNoteId || !nextNoteId) return;

      if (e.target !== e.currentTarget) {
        if (!(e.target instanceof HTMLElement)) return;
        if (e.target instanceof HTMLAnchorElement) return;

        const closestLink = e.target.closest('[role="link"]');
        if (closestLink !== e.currentTarget) return;
      }

      e.preventDefault();

      if ((!forceStackOpen && e.shiftKey) || (!e.shiftKey && forceStackOpen)) {
        history.push(
          generateStackedNotePath(
            location.search,
            vault.$modelId,
            currentNoteId,
            nextNoteId,
          ),
        );
      } else {
        history.push(
          paths.vaultNotePath({
            vaultId: vault.$modelId,
            noteId: nextNoteId,
          }) + location.search,
        );
      }
    },
    [
      currentNoteId,
      forceStackOpen,
      history,
      location.search,
      nextNoteId,
      vault.$modelId,
    ],
  );
};
