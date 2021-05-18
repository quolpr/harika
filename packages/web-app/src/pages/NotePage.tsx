import React, { useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import 'react-calendar/dist/Calendar.css';
import { Note } from '../components/Note/Note';
import { useNoteRepository } from '../contexts/CurrentNoteRepositoryContext';
import { useCurrentVaultUiState } from '../contexts/CurrentVaultUiStateContext';
import { observer } from 'mobx-react-lite';
import { useCurrentVault } from '../hooks/useCurrentVault';
import { useCurrentNote } from '../hooks/useCurrentNote';
import { useUnmount } from 'react-use';

export const NotePage = observer(() => {
  const vault = useCurrentVault();
  const noteRepo = useNoteRepository();
  const { noteId } = useParams<{ noteId: string }>();
  const vaultUiState = useCurrentVaultUiState();

  useEffect(() => {
    const callback = async () => {
      const note = await noteRepo.findNote(vault, noteId);
      if (!note) {
        alert('note not found!');
      } else {
        vaultUiState.setCurrentNoteId(note.$modelId);
      }
    };

    callback();
  }, [vault, noteId, noteRepo, vaultUiState]);

  useUnmount(() => {
    vaultUiState.setCurrentNoteId(undefined);
  });

  const note = useCurrentNote();

  return note ? <Note note={note} /> : null;
});
