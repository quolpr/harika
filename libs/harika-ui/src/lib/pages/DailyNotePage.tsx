import React, { useEffect } from 'react';
import dayjs from 'dayjs';
import { useHistory } from 'react-router-dom';
import { useNoteRepository } from '../contexts/CurrentNoteRepositoryContext';
import { useCurrentVault } from '../hooks/useCurrentVault';
import { useCurrentVaultUiState } from '../contexts/CurrentVaultUiStateContext';
import { useCurrentNote } from '../hooks/useCurrentNote';
import { Note } from '../components/Note/Note';
import { observer } from 'mobx-react-lite';

export const DailyNotePage = observer(() => {
  const vault = useCurrentVault();
  const noteRepo = useNoteRepository();
  const history = useHistory();
  const vaultUiState = useCurrentVaultUiState();

  useEffect(() => {
    const toExecute = async () => {
      const result = await noteRepo.getOrCreateDailyNote(vault, dayjs());

      if (result.status === 'ok') {
        vaultUiState.setCurrentNoteId(result.data.$modelId);
      }
    };

    toExecute();
  }, [history, vault, noteRepo, vaultUiState]);

  const note = useCurrentNote();

  return note ? <Note note={note} /> : null;
});
