import React, {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import './styles.css';
import { observer } from 'mobx-react-lite';
import { useLocation, useNavigate } from 'react-router-dom';
import { LinkIcon } from '@heroicons/react/solid';
import { CurrentBlockInputRefContext } from '../../contexts';
import {
  getCollapsableBlock,
  NoteBlock as NoteBlockModel,
} from '@harika/web-core';
import { groupBy } from 'lodash-es';
import { useObservable, useObservableState } from 'observable-hooks';
import { map, of, switchMap } from 'rxjs';
import AutosizeInput from 'react-input-autosize';
import dayjs from 'dayjs';
import { bem } from '../../utils';

import LeftArrow from '../../icons/left-arrow.svg?component';
import RightArrow from '../../icons/right-arrow.svg?component';
import { useMedia } from 'react-use';
import { BacklinkedNote } from './BacklinkedNote';
import {
  useAllBlocksService,
  useBlocksScopesService,
  useNoteBlocksService,
  useUpdateTitleService,
} from '../../hooks/vaultAppHooks';
import {
  FocusedBlockState,
  useFocusedBlock,
} from '../../hooks/useFocusedBlockState';
import { useNotePath } from '../../contexts/StackedNotesContext';
import { NoteBlock } from '@harika/web-core';
import { ChildrenBlocks } from './ChildrenBlocks';

export interface IFocusBlockState {
  focusOnBlockId: string;
}

const BacklinkedNotes = observer(({ note }: { note: NoteBlockModel }) => {
  const allBlocksService = useAllBlocksService();
  const blocksScopesService = useBlocksScopesService();

  // TODO: data getting looks pretty complex. It will be good to refactor
  const backlinks$ = useObservable(
    ($inputs) => {
      return $inputs.pipe(
        switchMap(([note]) =>
          allBlocksService
            .getBacklinkedBlocks$(note.$modelId)
            .pipe(map((noteLinks) => ({ noteLinks: noteLinks, note }))),
        ),
        switchMap(async ({ noteLinks, note }) => {
          if (noteLinks.length > 0) {
            const scopes = await blocksScopesService.getBlocksScopes(
              noteLinks.flatMap((linkedNote) =>
                linkedNote.blocks.map((block) => ({
                  scopedBy: note,
                  rootBlockId: block.$modelId,
                })),
              ),
            );

            return {
              referencesCount: scopes.length,
              groupedScopes: groupBy(scopes, (sc) => sc.rootBlockId),
              noteLinks: noteLinks,
              note,
            };
          } else {
            return { referencesCount: 0, groupedScopes: {}, noteLinks, note };
          }
        }),
        switchMap(async ({ noteLinks, referencesCount, groupedScopes }) => {
          return {
            areLoaded: true,
            noteLinks: noteLinks,
            referencesCount,
            groupedScopes,
          };
        }),
      );
    },
    [note],
  );

  const backlinks = useObservableState(backlinks$, {
    areLoaded: false,
    noteLinks: [],
    groupedScopes: {},
    referencesCount: 0,
  });

  const linksBlocksWithScope = useMemo(
    () =>
      backlinks.noteLinks.map((link) => ({
        note: link.rootBlock as NoteBlock,
        scopesWithBlocks: link.blocks.flatMap((rootBlock) => {
          const scopes = backlinks.groupedScopes[rootBlock.$modelId];
          const scope = scopes.find(
            (sc) => sc.rootBlockId === rootBlock.$modelId,
          );
          if (!scope) return [];

          return {
            scope,
            rootBlock: getCollapsableBlock(scope, rootBlock),
          };
        }),
      })),
    [backlinks],
  );

  return (
    <>
      {backlinks.areLoaded ? (
        <div className="note__linked-references">
          <LinkIcon className="note__link-icon" style={{ width: 16 }} />
          {backlinks.referencesCount} Linked References
        </div>
      ) : (
        <div className="note__linked-references">
          <LinkIcon className="note__link-icon" style={{ width: 16 }} />
          References are loading...
        </div>
      )}

      {linksBlocksWithScope.map((link) => (
        <BacklinkedNote
          key={link.note.$modelId}
          note={link.note}
          scopesWithBlocks={link.scopesWithBlocks}
        />
      ))}
    </>
  );
});

const noteClass = bem('note');

const NoteBody = observer(({ note }: { note: NoteBlock }) => {
  const isWide = useMedia('(min-width: 768px)');
  const focusedBlock = useFocusedBlock();
  const navigate = useNavigate();

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
      focusedBlock.setState(
        FocusedBlockState.create(note.$modelId, focusOnBlockId),
      );
    }
  }, [focusOnBlockId, note.$modelId, focusedBlock]);

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
        navigate(
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
