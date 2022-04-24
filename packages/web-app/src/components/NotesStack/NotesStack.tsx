/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { XIcon } from '@heroicons/react/solid';
import { observer } from 'mobx-react-lite';
import React, { useCallback, useEffect, useRef } from 'react';
import { useMedia } from 'react-use';
import tw, { styled } from 'twin.macro';

import { ContainerElRefContext } from '../../contexts/ContainerElRefContext';
import {
  CurrentStackContext,
  IStack,
  useCloseNote,
  useFocusedStackIdContext,
} from '../../contexts/StackedNotesContext';
import { CurrentNoteContext } from '../../hooks/useCurrentNote';
import { cn } from '../../utils';
import { NoteBlockComponent } from '../NoteBlock/NoteBlockComponent';
import { useFindNote } from './useFindNote';

const notesStackClass = cn('notes-stack');

const NotesStackStyled = styled.div`
  display: flex;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;

  height: 100%;
  width: 100%;
`;

const Row = styled.div`
  ${tw`px-5 max-w-screen-lg`}

  width: 100%;
  height: 100%;
  margin: 0 auto;
  position: relative;

  overflow-y: auto;
  overflow-x: hidden;
  min-width: calc(max(100% / 4, 350px));
`;

const CloseBtn = styled.button`
  position: absolute;

  right: 10px;
  top: 5px;
`;

const SimpleNote = observer(({ stack }: { stack: IStack }) => {
  const { note, isLoading } = useFindNote(stack.entityId);

  return (
    <>
      {note && (
        <CurrentStackContext.Provider value={stack}>
          <CurrentNoteContext.Provider value={note}>
            <NoteBlockComponent note={note} />
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
        <Row
          className={notesStackClass('row')}
          ref={rowRef}
          onClick={handleFocus}
        >
          <ContainerElRefContext.Provider value={rowRef}>
            {!isSingle && (
              <CloseBtn
                className={notesStackClass('close-btn')}
                onClick={handleClose}
              >
                <XIcon style={{ width: 20 }} />
              </CloseBtn>
            )}

            {note && (
              <CurrentNoteContext.Provider value={note}>
                <NoteBlockComponent note={note} />
              </CurrentNoteContext.Provider>
            )}
            {!note && !isLoading && 'NoteModel not found :('}
          </ContainerElRefContext.Provider>
        </Row>
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
    <NotesStackStyled className={notesStackClass()} ref={parentRef}>
      {stacks.map((stack, i) => (
        <NoteStack
          key={stack.stackId + stack.entityId}
          stack={stack}
          noteId={stack.entityId}
          isSingle={stacks.length === 1}
          isLast={i === stacks.length - 1}
          parentRef={parentRef}
        />
      ))}
    </NotesStackStyled>
  ) : lastStack ? (
    <SimpleNote stack={lastStack} key={lastStack.entityId} />
  ) : null;
};
