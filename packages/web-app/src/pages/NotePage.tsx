import React, { useEffect, useState } from 'react';
import 'react-calendar/dist/Calendar.css';
import { Note } from '../components/Note/Note';
import { observer } from 'mobx-react-lite';
import { useHistory, useParams } from 'react-router-dom';
import { useUnmount } from 'react-use';
import { EMPTY } from 'rxjs';
import { timeout, filter, tap } from 'rxjs/operators';
import { useNoteRepository } from '../contexts/CurrentNoteRepositoryContext';
import { useCurrentVaultUiState } from '../contexts/CurrentVaultUiStateContext';
import { useCurrentNote } from '../hooks/useCurrentNote';
import { useCurrentVault } from '../hooks/useCurrentVault';
import { paths } from '../paths';

const useFindNote = (noteId: string) => {
  const vault = useCurrentVault();
  const noteRepo = useNoteRepository();
  const vaultUiState = useCurrentVaultUiState();
  const history = useHistory();
  const note = useCurrentNote();

  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const callback = async () => {
      const note = await noteRepo.findNote(vault, noteId);
      if (!note) {
        setIsLoading(false);
      } else {
        vaultUiState.setCurrentNoteId(note.$modelId);

        if (!note.isDeleted) {
          setIsLoading(false);
        }
      }
    };

    callback();
  }, [vault, noteId, noteRepo, vaultUiState]);

  const noteTitle = note?.title;
  const isDeleted = note?.isDeleted;
  useEffect(() => {
    if (!noteTitle || !noteId || isDeleted === undefined) return;

    if (isDeleted) {
      // In case conflict resolving. We wait for n seconds for new id of note title to appear
      const flow = noteRepo
        .getNoteIdByTitle$(vault, noteTitle)
        .pipe(
          tap((v) => console.log({ v })),
          timeout({ each: 500, with: () => EMPTY }),
          filter((v) => !!v && v !== noteId),
        )
        .subscribe({
          next(newId: string) {
            history.replace(
              paths.vaultNotePath({ vaultId: vault.$modelId, noteId: newId }),
            );
          },
          complete() {
            console.log('finally not found :(');
            vaultUiState.setCurrentNoteId(undefined);
            setIsLoading(false);
          },
        });

      return () => flow.unsubscribe();
    }
  }, [history, isDeleted, noteId, noteRepo, noteTitle, vault, vaultUiState]);

  useUnmount(() => {
    vaultUiState.setCurrentNoteId(undefined);
  });

  return { note, isLoading };
};

export const NotePage = observer(() => {
  const { noteId } = useParams<{ noteId: string }>();
  const { note, isLoading } = useFindNote(noteId);

  return (
    <>
      {isLoading && 'Loading...'}
      {note && !isLoading && <Note note={note} />}
      {!note && !isLoading && 'Note not found :('}
    </>
  );
});

export default NotePage;
