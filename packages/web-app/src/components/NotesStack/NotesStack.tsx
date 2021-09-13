import { observer } from 'mobx-react-lite';
import React, { useCallback, useEffect, useRef } from 'react';
import { useMedia } from 'react-use';
import { CurrentNoteContext } from '../../hooks/useCurrentNote';
import { cn } from '../../utils';
import { Note } from '../Note/Note';
import { XIcon } from '@heroicons/react/solid';
import queryString from 'query-string';
import './styles.css';

import { useFindNote } from './useFindNote';
import { useHistory, useLocation } from 'react-router-dom';
import { paths } from '../../paths';
import { useCurrentVault } from '../../hooks/useCurrentVault';

const notesStackClass = cn('notes-stack');

const SimpleNote = observer(({ noteId }: { noteId: string }) => {
  const { note, isLoading } = useFindNote(noteId);

  return (
    <>
      {isLoading && 'Loading...'}
      {note && !isLoading && (
        <CurrentNoteContext.Provider value={note}>
          <Note note={note} />
        </CurrentNoteContext.Provider>
      )}
      {!note && !isLoading && 'NoteModel not found :('}
    </>
  );
});

const NoteStack = observer(
  ({
    noteId,
    isLast,
    parentRef,
    isSingle,
  }: {
    noteId: string;
    isLast: boolean;
    parentRef: React.RefObject<HTMLDivElement>;
    isSingle: boolean;
  }) => {
    const location = useLocation();
    const history = useHistory();
    const vaultId = useCurrentVault().$modelId;
    const { note, isLoading } = useFindNote(noteId);

    useEffect(() => {
      setTimeout(() => {
        if (note && !isLoading && isLast && parentRef.current) {
          parentRef.current.scrollLeft = parentRef.current.scrollWidth;
        }
      }, 50);
    }, [note, isLoading, isLast, parentRef]);

    const handleClose = useCallback(() => {
      const parsedCurrentQuery = queryString.parse(location.search);
      const currentIds = (
        parsedCurrentQuery.stackedIds ? [parsedCurrentQuery.stackedIds] : []
      ).flat();

      const newLocation = (() => {
        if (isLast) {
          return {
            query: { stackedIds: currentIds.slice(0, -1) },
            path: paths.vaultNotePath({
              vaultId,
              noteId: currentIds[currentIds.length - 1],
            }),
          };
        } else {
          return {
            query: { stackedIds: currentIds.filter((id) => id !== noteId) },
            path: location.pathname,
          };
        }
      })();

      history.push(
        `${newLocation.path}?${queryString.stringify(newLocation.query)}`,
      );
    }, [history, isLast, location.pathname, location.search, noteId, vaultId]);

    return (
      <div className={notesStackClass('row')}>
        {!isSingle && (
          <button
            className={notesStackClass('close-btn')}
            onClick={handleClose}
          >
            <XIcon style={{ width: 20 }} />
          </button>
        )}

        {isLoading && 'Loading...'}
        {note && !isLoading && (
          <CurrentNoteContext.Provider value={note}>
            <Note note={note} />
          </CurrentNoteContext.Provider>
        )}
        {!note && !isLoading && 'NoteModel not found :('}
      </div>
    );
  },
);

export const NotesStack = ({ ids }: { ids: string[] }) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const isWide = useMedia('(min-width: 768px)');

  return isWide ? (
    <div className={notesStackClass()} ref={parentRef}>
      {ids.map((id, i) => (
        <NoteStack
          key={id}
          noteId={id}
          isSingle={ids.length === 1}
          isLast={i === ids.length - 1}
          parentRef={parentRef}
        />
      ))}
    </div>
  ) : (
    <SimpleNote noteId={ids[ids.length - 1]} />
  );
};
