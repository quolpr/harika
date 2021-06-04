import type { NoteModel } from '@harika/web-core';
import { useCurrentVault } from './useCurrentVault';

export const useCurrentNote = (): NoteModel | undefined => {
  const currentVault = useCurrentVault();

  return currentVault.ui.currentNoteId
    ? currentVault.notesMap[currentVault.ui.currentNoteId]
    : undefined;
};
