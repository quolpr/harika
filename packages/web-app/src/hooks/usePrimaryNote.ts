import { NoteModel } from '@harika/web-core';
import pathToRegexp from 'path-to-regexp';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PATHS } from '../paths';
import { useNotesService } from './vaultAppHooks';

export const usePrimaryNoteId = () => {
  const location = useLocation();

  return useMemo(
    () => pathToRegexp(PATHS.VAULT_NOTE_PATH).exec(location.pathname)?.[2],
    [location.pathname],
  );
};

export const usePrimaryNote = () => {
  const primaryNoteId = usePrimaryNoteId();
  const notesService = useNotesService();
  const [primaryNote, setPrimaryNote] = useState<NoteModel>();

  useEffect(() => {
    const callback = async () => {
      if (!primaryNoteId) return;

      setPrimaryNote(await notesService.getNote(primaryNoteId));
    };

    callback();
  }, [primaryNoteId, notesService]);

  return primaryNote;
};
