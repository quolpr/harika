import pathToRegexp from 'path-to-regexp';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useNotesService } from '../contexts/CurrentNotesServiceContext';
import { PATHS } from '../paths';
import type { NoteModel } from '@harika/web-core';

export const usePrimaryNoteId = () => {
  const location = useLocation();

  return useMemo(
    () => pathToRegexp(PATHS.VAULT_NOTE_PATH).exec(location.pathname)?.[2],
    [location.pathname],
  );
};

export const usePrimaryNote = () => {
  const primaryNoteId = usePrimaryNoteId();
  const repo = useNotesService();
  const [primaryNote, setPrimaryNote] = useState<NoteModel>();

  useEffect(() => {
    const callback = async () => {
      if (!primaryNoteId) return;

      setPrimaryNote(await repo.findNote(primaryNoteId));
    };

    callback();
  }, [primaryNoteId, repo]);

  return primaryNote;
};
