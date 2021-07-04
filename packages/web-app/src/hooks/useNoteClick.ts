import type { VaultModel } from '@harika/web-core';
import queryString from 'query-string';
import { useLocation } from 'react-router-dom';
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

export const useNotePath = (
  vault: VaultModel,
  currentNoteId: string | undefined,
  nextNoteId: string | undefined,
) => {
  const location = useLocation();

  return currentNoteId && nextNoteId
    ? generateStackedNotePath(
        location.search,
        vault.$modelId,
        currentNoteId,
        nextNoteId,
      )
    : '';
};
