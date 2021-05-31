import React, { useContext, useEffect, useState } from 'react';
import 'react-calendar/dist/Calendar.css';
import { Note } from '../components/Note/Note';
import { observer } from 'mobx-react-lite';
import { useHistory, useParams } from 'react-router-dom';
import { useUnmount } from 'react-use';
import { NEVER, of, race } from 'rxjs';
import { timeout, map } from 'rxjs/operators';
import { useNoteRepository } from '../contexts/CurrentNoteRepositoryContext';
import { useCurrentVaultUiState } from '../contexts/CurrentVaultUiStateContext';
import { useCurrentNote } from '../hooks/useCurrentNote';
import { useCurrentVault } from '../hooks/useCurrentVault';
import { paths } from '../paths';
import { LoadingDoneSubjectContext } from '../contexts';

type IPipeResult = { status: 'found'; id: string } | { status: 'not_found' };

const useFindNote = (noteId: string) => {
  const vault = useCurrentVault();
  const noteRepo = useNoteRepository();
  const vaultUiState = useCurrentVaultUiState();
  const history = useHistory();
  const note = useCurrentNote();
  const loadingDoneSubject = useContext(LoadingDoneSubjectContext);

  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const callback = async () => {
      const note = await noteRepo.findNote(noteId);
      if (!note) {
        setIsLoading(false);
      } else {
        vaultUiState.setCurrentNoteId(note.$modelId);

        if (!note.isDeleted) {
          setIsLoading(false);
          loadingDoneSubject.next();
        }
      }
    };

    callback();
  }, [loadingDoneSubject, noteId, noteRepo, vaultUiState]);

  const noteTitle = note?.title;
  const isDeleted = note?.isDeleted;
  useEffect(() => {
    if (!noteTitle || !noteId || isDeleted === undefined) return;

    if (isDeleted) {
      // In case conflict resolving. We wait for n seconds for new id of note title to appear
      const flow = race(
        noteRepo.getNoteIdByTitle$(noteTitle).pipe(
          map(
            (val): IPipeResult => ({
              status: 'found',
              id: val,
            }),
          ),
        ),
        NEVER.pipe(
          timeout({
            first: 1000,
            with: () => of<IPipeResult>({ status: 'not_found' }),
          }),
        ),
      ).subscribe({
        next(res) {
          if (res.status === 'found') {
            history.replace(
              paths.vaultNotePath({ vaultId: vault.$modelId, noteId: res.id }),
            );
          } else {
            setIsLoading(false);
          }
        },
      });

      return () => flow.unsubscribe();
    }
  }, [
    history,
    isDeleted,
    noteId,
    noteRepo,
    noteTitle,
    vault.$modelId,
    vaultUiState,
  ]);

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
