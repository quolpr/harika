import type { NoteModel } from '@harika/web-core';
import { useContext, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { NEVER, of, race } from 'rxjs';
import { timeout, map } from 'rxjs/operators';
import { LoadingDoneSubjectContext } from '../../contexts';
import { useNoteRepository } from '../../contexts/CurrentNoteRepositoryContext';
import { useCurrentVault } from '../../hooks/useCurrentVault';
import { paths } from '../../paths';

type IPipeResult = { status: 'found'; id: string } | { status: 'not_found' };

export const useFindNote = (noteId: string) => {
  const vault = useCurrentVault();
  const noteRepo = useNoteRepository();
  const history = useHistory();

  const [note, setNote] = useState<NoteModel | undefined>();
  const loadingDoneSubject = useContext(LoadingDoneSubjectContext);

  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const callback = async () => {
      const note = await noteRepo.findNote(noteId, {
        preloadChildren: true,
        preloadBlockLinks: true,
        preloadNoteLinks: true,
      });

      if (!note) {
        setIsLoading(false);
      } else {
        await Promise.all([
          noteRepo.preloadOrCreateBlocksView(note, note),
          ...note.linkedBlocks.map((block) =>
            noteRepo.preloadOrCreateBlocksView(note, block),
          ),
        ]);

        setNote(note);

        if (!note.isDeleted) {
          setIsLoading(false);
          loadingDoneSubject.next();
        }
      }
    };

    callback();
  }, [loadingDoneSubject, noteId, noteRepo, vault.ui]);

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
  }, [history, isDeleted, noteId, noteRepo, noteTitle, vault.$modelId]);

  return { note, isLoading };
};
