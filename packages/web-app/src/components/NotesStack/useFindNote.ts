import { NoteBlock } from '@harika/web-core';
import { useContext, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { firstValueFrom, NEVER, of, race } from 'rxjs';
import { timeout, map } from 'rxjs/operators';
import { LoadingDoneSubjectContext } from '../../contexts';
import { useNotePath } from '../../contexts/StackedNotesContext';
import {
  useAllBlocksService,
  useCurrentVaultId,
  useNoteBlocksService,
} from '../../hooks/vaultAppHooks';

type IPipeResult = { status: 'found'; id: string } | { status: 'not_found' };

export const useFindNote = (noteId: string) => {
  const vaultId = useCurrentVaultId();
  const notesService = useNoteBlocksService();

  const history = useHistory();

  const [note, setNote] = useState<NoteBlock | undefined>();
  const loadingDoneSubject = useContext(LoadingDoneSubjectContext);

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const allBlocksService = useAllBlocksService();

  useEffect(() => {
    const callback = async () => {
      const note = (await allBlocksService.getBlockById(noteId)) as NoteBlock;

      if (!note) {
        setIsLoading(false);
      } else {
        setNote(note);

        setIsLoading(false);
        loadingDoneSubject.next();
      }
    };

    callback();
  }, [allBlocksService, loadingDoneSubject, noteId, notesService]);

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
