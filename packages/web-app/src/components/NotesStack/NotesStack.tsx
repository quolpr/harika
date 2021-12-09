/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { observer } from 'mobx-react-lite';
import React, { useCallback, useEffect, useRef } from 'react';
import { useMedia } from 'react-use';
import { CurrentNoteContext } from '../../hooks/useCurrentNote';
import { cn } from '../../utils';
import { Note } from '../Note/Note';
import { XIcon } from '@heroicons/react/solid';
import './styles.css';

import { useFindNote } from './useFindNote';
import { ContainerElRefContext } from '../../contexts/ContainerElRefContext';
import { CustomScrollbar } from '../CustomScrollbar';
import {
  CurrentStackContext,
  IStack,
  useCloseNote,
  useFocusedStackIdContext,
} from '../../contexts/StackedNotesContext';

const notesStackClass = cn('notes-stack');

const SimpleNote = observer(({ stack }: { stack: IStack }) => {
  const { note, isLoading } = useFindNote(stack.entityId);

  return (
    <>
      {isLoading && 'Loading...'}
      {note && !isLoading && (
        <CurrentStackContext.Provider value={stack}>
          <CurrentNoteContext.Provider value={note}>
            <Note note={note} />
          </CurrentNoteContext.Provider>
        </CurrentStackContext.Provider>
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
    stack,
  }: {
    noteId: string;
    isLast: boolean;
    parentRef: React.RefObject<HTMLDivElement>;
    isSingle: boolean;
    stack: IStack;
  }) => {
    const { note, isLoading } = useFindNote(noteId);

    const rowRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      setTimeout(() => {
        if (note && !isLoading && isLast && parentRef.current) {
          parentRef.current.scrollLeft = parentRef.current.scrollWidth;
        }
      }, 50);
    }, [note, isLoading, isLast, parentRef]);

    const handleClose = useCloseNote(stack.stackId);

    const { setStackId } = useFocusedStackIdContext();
    const handleFocus = useCallback(() => {
      setStackId(stack.stackId);
    }, [setStackId, stack.stackId]);

    return (
      <CurrentStackContext.Provider value={stack}>
        <div
          className={notesStackClass('row')}
          ref={rowRef}
          onClick={handleFocus}
        >
          <CustomScrollbar noScrollX>
            <ContainerElRefContext.Provider value={rowRef}>
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
            </ContainerElRefContext.Provider>
          </CustomScrollbar>
        </div>
      </CurrentStackContext.Provider>
    );
  },
);

export const NotesStack = ({ stacks }: { stacks: IStack[] }) => {
  const lastStack: IStack | undefined = stacks[stacks.length - 1];
  const lastStackId = lastStack?.stackId;
  const parentRef = useRef<HTMLDivElement>(null);
  const isWide = useMedia('(min-width: 768px)');

  const { setStackId } = useFocusedStackIdContext();

  useEffect(() => {
    if (isWide) return;

    setStackId(lastStackId);
  }, [isWide, lastStackId, setStackId]);

  return isWide ? (
    <CustomScrollbar noScrollY>
      <div className={notesStackClass()} ref={parentRef}>
        {stacks.map((stack, i) => (
          <NoteStack
            key={stack.stackId}
            stack={stack}
            noteId={stack.entityId}
            isSingle={stacks.length === 1}
            isLast={i === stacks.length - 1}
            parentRef={parentRef}
          />
        ))}
      </div>
    </CustomScrollbar>
  ) : lastStack ? (
    <SimpleNote stack={lastStack} />
  ) : null;
};
