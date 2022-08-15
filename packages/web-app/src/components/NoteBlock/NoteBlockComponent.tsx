import { NoteBlock } from '@harika/web-core';
import dayjs from 'dayjs';
import { observer } from 'mobx-react-lite';
import React, {
  ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import AutosizeInput from 'react-input-autosize';
import { useLocation } from 'react-router-dom';
import { useMedia } from 'react-use';
import tw, { styled } from 'twin.macro';

import { CurrentBlockInputRefContext } from '../../contexts';
import { useNotePath } from '../../contexts/StackedNotesContext';
import { useBlockFocusState } from '../../hooks/useBlockFocusState';
import {
  useNoteBlocksService,
  useUpdateTitleService,
} from '../../hooks/vaultAppHooks';
import LeftArrow from '../../icons/left-arrow.svg?component';
import RightArrow from '../../icons/right-arrow.svg?component';
import { bem, useNavigateRef } from '../../utils';
import { BacklinkedNotes } from './BacklinkedNotes';
import { ChildrenBlocks } from './ChildrenBlocks';

const NoteStyled = styled.div`
  ${tw`pb-5 pt-5`}
  display: flex;
  flex-direction: column;
  clear: both;
`;

const NoteHeader = styled.h2`
  ${tw`text-gray-100 pb-4 font-bold`}
  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 1.875rem;

  @media (min-width: 768px) {
    font-size: 2rem;
  }
`;

const LeftBtn = styled.button`
  padding: 0.75rem;
  margin-right: 0.5rem;
  transform: scale(0.7);

  @media (min-width: 768px) {
    transform: scale(1);
    padding: 1rem;
    margin-right: 3rem;
  }
`;

const RightBtn = styled.button`
  padding: 0.75rem;
  margin-left: 0.5rem;
  transform: scale(0.7);

  @media (min-width: 768px) {
    transform: scale(1);
    padding: 1rem;
    margin-left: 3rem;
  }
`;

const InputBox = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;

  min-width: 12rem;
  @media (min-width: 768px) {
    min-width: 21rem;
  }
`;

export interface IFocusBlockState {
  focusOnBlockId: string;
}

const noteClass = bem('note');

const NoteBody = observer(({ note }: { note: NoteBlock }) => {
  const isWide = useMedia('(min-width: 768px)');
  const blockFocusState = useBlockFocusState();
  const navigate = useNavigateRef();

  const location = useLocation();
  const locationState = location.state as IFocusBlockState | undefined;
  const focusOnBlockId = (locationState || {}).focusOnBlockId;

  const updateTitleService = useUpdateTitleService();
  const noteBlocksService = useNoteBlocksService();

  const [noteTitle, setNoteTitle] = useState(note.title);

  useEffect(() => {
    setNoteTitle(note.title);
  }, [note.title]);

  const changeTitle = useCallback(() => {
    if (note.title === noteTitle) return;

    void (async () => {
      const result = await updateTitleService.updateNoteTitle(
        note.$modelId,
        noteTitle,
      );

      if (result === 'exists') {
        alert(
          `Can't change note title to ${noteTitle} - such note already exists`,
        );

        setNoteTitle(note.title);
      }
    })();
  }, [note.$modelId, note.title, noteTitle, updateTitleService]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.currentTarget.blur();
      }
    },
    [],
  );

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setNoteTitle(e.currentTarget.value);
  }, []);

  useEffect(() => {
    if (focusOnBlockId) {
      setTimeout(() => {
        blockFocusState.changeFocus(
          note.$modelId,
          focusOnBlockId,
          undefined,
          true,
        );
      }, 0);
    }
  }, [focusOnBlockId, note.$modelId, blockFocusState]);

  const inputId = `note-title-input-${note.$modelId}`;

  const isDailyNote = note.dailyNoteDate !== undefined;

  const notePath = useNotePath();

  const handleArrowClick = useCallback(
    async (ev: React.MouseEvent, direction: 'next' | 'prev') => {
      if (!note.dailyNoteDate) return;

      const noteDate = dayjs.unix(note.dailyNoteDate / 1000);

      const result = await (async () => {
        if (direction === 'next') {
          return await noteBlocksService.getOrCreateDailyNote(
            noteDate.add(1, 'day'),
          );
        } else {
          return await noteBlocksService.getOrCreateDailyNote(
            noteDate.subtract(1, 'day'),
          );
        }
      })();

      if (result.status === 'ok') {
        navigate.current(
          notePath(
            result.data.$modelId,
            Boolean(ev.nativeEvent.shiftKey && note.$modelId),
          ),
          { replace: true },
        );
      }
    },
    [navigate, note.$modelId, note.dailyNoteDate, noteBlocksService, notePath],
  );

  return (
    <NoteStyled className={noteClass()}>
      <NoteHeader className={noteClass('header')}>
        <label htmlFor={inputId} className="hidden-label">
          Note title
        </label>
        {isDailyNote && note.dailyNoteDate && (
          <LeftBtn
            className={noteClass('leftArrow')}
            onClick={(e) => void handleArrowClick(e, 'prev')}
          >
            <LeftArrow />
          </LeftBtn>
        )}
        <InputBox className={noteClass('inputBox')}>
          <AutosizeInput
            disabled={isDailyNote}
            id={inputId}
            value={noteTitle}
            onBlur={changeTitle}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            inputStyle={{
              fontWeight: 'bold',
              backgroundColor: 'transparent',
              fontSize: isWide ? 48 : 30,
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
            }}
          />
        </InputBox>
        {isDailyNote && (
          <RightBtn
            className={noteClass('rightArrow')}
            onClick={(e) => void handleArrowClick(e, 'next')}
          >
            <RightArrow />
          </RightBtn>
        )}
      </NoteHeader>

      <ChildrenBlocks note={note} />

      <BacklinkedNotes note={note} />
    </NoteStyled>
  );
});

// Performance optimization here with context and separate component
export const NoteBlockComponent: React.FC<{ note: NoteBlock }> = React.memo(
  ({ note }) => {
    const currentBlockInputRef = useRef<HTMLTextAreaElement>(null);

    return (
      <CurrentBlockInputRefContext.Provider value={currentBlockInputRef}>
        <NoteBody note={note} />
      </CurrentBlockInputRefContext.Provider>
    );
  },
);
