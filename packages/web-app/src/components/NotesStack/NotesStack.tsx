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
      {!note && !isLoading && 'Note not found :('}
    </>
  );
});

const NoteStack = observer(
  ({
    noteId,
    isLast,
    parentRef,
  }: {
    noteId: string;
    isLast: boolean;
    parentRef: React.RefObject<HTMLDivElement>;
  }) => {
    const location = useLocation();
    const history = useHistory();
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

      const newQuery = {
        stackedIds: (parsedCurrentQuery.stackedIds
          ? [parsedCurrentQuery.stackedIds]
          : []
        )
          .flat()
          .filter((id) => id !== noteId),
      };

      history.push(`${location.pathname}?${queryString.stringify(newQuery)}`);
    }, [history, location.pathname, location.search, noteId]);

    return (
      <div className={notesStackClass('row')}>
        {!isLast && (
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
        {!note && !isLoading && 'Note not found :('}
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
          isLast={i === ids.length - 1}
          parentRef={parentRef}
        />
      ))}
    </div>
  ) : (
    <SimpleNote noteId={ids[ids.length - 1]} />
  );
};
