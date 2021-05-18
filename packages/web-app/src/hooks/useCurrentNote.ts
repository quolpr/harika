import type { NoteModel } from '@harika/web-core';
import { useCurrentVaultUiState } from '../contexts/CurrentVaultUiStateContext';
import { useCurrentVault } from './useCurrentVault';

export const useCurrentNote = (): NoteModel | undefined => {
  const currentVault = useCurrentVault();
  const vaultUiState = useCurrentVaultUiState();

  return vaultUiState.currentNoteId
    ? currentVault.notesMap[vaultUiState.currentNoteId]
    : undefined;
};