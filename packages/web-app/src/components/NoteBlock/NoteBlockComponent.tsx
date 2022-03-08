import './styles.css';

import {
  getGroupedBacklinks,
  NoteBlock as NoteBlockModel,
} from '@harika/web-core';
import { NoteBlock } from '@harika/web-core';
import { LinkIcon } from '@heroicons/react/solid';
import dayjs from 'dayjs';
import { isEqual } from 'lodash-es';
import { comparer, computed } from 'mobx';
import { observer } from 'mobx-react-lite';
import { useObservable, useObservableState } from 'observable-hooks';
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
import {
  combineLatest,
  distinctUntilChanged,
  map,
  mapTo,
  of,
  switchMap,
} from 'rxjs';

import { CurrentBlockInputRefContext } from '../../contexts';
import { useNotePath } from '../../contexts/StackedNotesContext';
import { useBlockFocusState } from '../../hooks/useBlockFocusState';
import {
  useAllBlocksService,
  useBlockLinksService,
  useBlockLinksStore,
  useBlocksScopesService,
  useBlocksScopesStore,
  useNoteBlocksService,
  useUpdateTitleService,
} from '../../hooks/vaultAppHooks';
import LeftArrow from '../../icons/left-arrow.svg?component';
import RightArrow from '../../icons/right-arrow.svg?component';
import { bem, useNavigateRef } from '../../utils';
import { BacklinkedNote } from './BacklinkedNote';
import { ChildrenBlocks } from './ChildrenBlocks';

export interface IFocusBlockState {
  focusOnBlockId: string;
}

const BacklinkedNotes = observer(({ note }: { note: NoteBlockModel }) => {
  const blocksScopesService = useBlocksScopesService();
  const blocksScopesStore = useBlocksScopesStore();
  const blockLinksService = useBlockLinksService();
  const blockLinksStore = useBlockLinksStore();
  const allBlocksService = useAllBlocksService();

  const backlinksLoader$ = useObservable(
    ($inputs) => {
      return $inputs.pipe(
        switchMap(([note]) =>
          blockLinksService
            .loadBacklinkedBlocks$(note.$modelId)
            .pipe(map((noteLinks) => ({ noteLinks, note }))),
        ),
        distinctUntilChanged((a, b) => isEqual(a, b)),
        switchMap(({ noteLinks, note }) => {
          if (noteLinks.rootsIds.length === 0) return of(true);

          return combineLatest([
            allBlocksService.loadBlocksTrees$(noteLinks.rootsIds),
            blocksScopesService.loadOrCreateBlocksScopes(
              noteLinks.links.flatMap((link) => ({
                scopedBy: note,
                rootBlockId: link.blockRef.id,
              })),
            ),
            blockLinksService.loadLinksOfBlockDescendants$(noteLinks.rootsIds),
          ]).pipe(mapTo(true));
        }),
      );
    },
    [note],
  );
  const areBacklinksLoaded = useObservableState(backlinksLoader$, false);

  const groupedBacklinks = computed(
    () => getGroupedBacklinks(blockLinksStore, blocksScopesStore, note),
    { equals: comparer.structural },
  ).get();

  return (
    <>
      {areBacklinksLoaded ? (
        <div className="note__linked-references">
          <LinkIcon className="note__link-icon" style={{ width: 16 }} />
          {groupedBacklinks.count} Linked References
        </div>
      ) : (
        <div className="note__linked-references">
          <LinkIcon className="note__link-icon" style={{ width: 16 }} />
          References are loading...
        </div>
      )}

      {groupedBacklinks.links.map((link) => (
        <BacklinkedNote
          key={link.rootBlock.$modelId}
          note={link.rootBlock as NoteBlock}
          scopesWithBlocks={link.scopesWithBlocks}
        />
      ))}
    </>
  );
});

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

  const changeTitle = useCallback(async () => {
    if (note.title === noteTitle) return;

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
            Boolean((ev.nativeEvent as MouseEvent).shiftKey && note.$modelId),
          ),
          { replace: true },
        );
      }
    },
    [navigate, note.$modelId, note.dailyNoteDate, noteBlocksService, notePath],
  );

  return (
    <div className={noteClass()}>
      <h2 className={noteClass('header')}>
        <label htmlFor={inputId} className="hidden-label">
          Note title
        </label>
        {isDailyNote && note.dailyNoteDate && (
          <button
            className={noteClass('leftArrow')}
            onClick={(e) => handleArrowClick(e, 'prev')}
          >
            <LeftArrow />
          </button>
        )}
        <div className={noteClass('inputBox')}>
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
        </div>
        {isDailyNote && (
          <button
            className={noteClass('rightArrow')}
            onClick={(e) => handleArrowClick(e, 'next')}
          >
            <RightArrow />
          </button>
        )}
      </h2>

      <ChildrenBlocks note={note} />

      <BacklinkedNotes note={note} />
    </div>
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
