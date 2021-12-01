import { NoteModel } from '@harika/web-core';
import { useEffect, useState } from 'react';
import { usePrimaryStack } from '../contexts/StackedNotesContext';
import { useNotesService } from './vaultAppHooks';

export const usePrimaryNoteId = () => {
  return usePrimaryStack()?.entityId;
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
