import type { NoteModel } from '@harika/web-core';
import { useContext, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { NEVER, of, race } from 'rxjs';
import { timeout, map } from 'rxjs/operators';
import { LoadingDoneSubjectContext } from '../../contexts';
import { useVaultService } from '../../contexts/CurrentNotesServiceContext';
import { useCurrentVaultApp } from '../../hooks/useCurrentVault';
import { paths } from '../../paths';

type IPipeResult = { status: 'found'; id: string } | { status: 'not_found' };

export const useFindNote = (noteId: string) => {
  const vault = useCurrentVaultApp();
  const notesService = useVaultService();
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
  }, [history, noteId, notesService, noteTitle, vault.$modelId, note]);

  return { note, isLoading };
};
