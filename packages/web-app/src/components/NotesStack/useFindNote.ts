import type { NoteModel } from '@harika/web-core';
import { useContext, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { NEVER, of, race } from 'rxjs';
import { timeout, map } from 'rxjs/operators';
import { LoadingDoneSubjectContext } from '../../contexts';
import { useNotePath } from '../../contexts/StackedNotesContext';
import { useCurrentVaultId, useNotesService } from '../../hooks/vaultAppHooks';

type IPipeResult = { status: 'found'; id: string } | { status: 'not_found' };

export const useFindNote = (noteId: string) => {
  const vaultId = useCurrentVaultId();
  const notesService = useNotesService();

  const history = useHistory();

  const [note, setNote] = useState<NoteModel | undefined>();
  const loadingDoneSubject = useContext(LoadingDoneSubjectContext);

  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const callback = async () => {
      const note = await notesService.getNote(noteId);

      if (!note) {
        setIsLoading(false);
      } else {
        setNote(note);

        setIsLoading(false);
        loadingDoneSubject.next();
      }
    };

    callback();
  }, [loadingDoneSubject, noteId, notesService]);

  const noteTitle = note?.title;

  const notePath = useNotePath();

  useEffect(() => {
    if (!noteTitle || !noteId) return;

    if (!note) {
      // In case conflict resolving. We wait for n seconds for new id of note title to appear
      const flow = race(
        notesService.getNoteIdByTitle$(noteTitle).pipe(
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
            history.replace(notePath(res.id));
          } else {
            setIsLoading(false);
          }
        },
      });

      return () => flow.unsubscribe();
    }
  }, [history, noteId, notesService, noteTitle, note, vaultId, notePath]);

  return { note, isLoading };
};
