import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import 'react-calendar/dist/Calendar.css';
import { Note } from '../components/Note/Note';
import { useNoteRepository } from '../contexts/CurrentNoteRepositoryContext';
import { useCurrentVaultUiState } from '../contexts/CurrentVaultUiStateContext';
import { observer } from 'mobx-react-lite';
import { useCurrentVault } from '../hooks/useCurrentVault';
import { useCurrentNote } from '../hooks/useCurrentNote';

export const NotePage = observer(() => {
  const vault = useCurrentVault();
  const noteRepo = useNoteRepository();
  const { noteId } = useParams<{ noteId: string }>();
  const vaultUiState = useCurrentVaultUiState();

  useEffect(() => {
    const callback = async () => {
      const note = await noteRepo.findNote(vault, noteId);
      vaultUiState.setCurrentNoteId(note.$modelId);
    };

    callback();

    return () => vaultUiState.setCurrentNoteId(undefined);
  }, [vault, noteId, noteRepo, vaultUiState]);

  const note = useCurrentNote();

  return note ? <Note note={note} /> : null;
});
