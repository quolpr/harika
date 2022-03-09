import { NoteBlock } from '@harika/web-core';
import { useContext, useEffect, useState } from 'react';
import { NEVER, of, race } from 'rxjs';
import { map, timeout } from 'rxjs/operators';

import { LoadingDoneSubjectContext } from '../../contexts';
import { useNotePath } from '../../contexts/StackedNotesContext';
import {
  useAllBlocksService,
  useBlocksStore,
  useCurrentVaultId,
  useNoteBlocksService,
} from '../../hooks/vaultAppHooks';
import { useNavigateRef } from '../../utils';

type IPipeResult = { status: 'found'; id: string } | { status: 'not_found' };

export const useFindNote = (noteId: string) => {
  const blocksStore = useBlocksStore();
  const vaultId = useCurrentVaultId();
  const notesService = useNoteBlocksService();

  const navigate = useNavigateRef();

  const [note, setNote] = useState<NoteBlock | undefined>(
    blocksStore.getBlockById(noteId) as NoteBlock,
  );
  const loadingDoneSubject = useContext(LoadingDoneSubjectContext);

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const allBlocksService = useAllBlocksService();

  useEffect(() => {
    const callback = async () => {
      const note = (await allBlocksService.getBlockWithTreeById(
        noteId,
      )) as NoteBlock;

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
            navigate.current(notePath(res.id));
          } else {
            setIsLoading(false);
          }
        },
      });

      return () => flow.unsubscribe();
    }
  }, [noteId, notesService, noteTitle, note, vaultId, notePath, navigate]);

  return { note, isLoading };
};
