import React, { ChangeEvent, useCallback, useRef } from 'react';
import './styles.css';
import { useEffect } from 'react';
import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { NoteModel } from '@harika/web-core';
import { useHistory, useLocation } from 'react-router-dom';
import { LinkIcon } from '@heroicons/react/solid';
import { CurrentBlockInputRefContext } from '../../contexts';
import { NoteBlocks } from './NoteBlocks';
import { groupBy } from 'lodash-es';
import { useObservable, useObservableState } from 'observable-hooks';
import { map, of, switchMap } from 'rxjs';
import AutosizeInput from 'react-input-autosize';
import dayjs from 'dayjs';
import { bem } from '../../utils';

import LeftArrow from '../../icons/left-arrow.svg?component';
import RightArrow from '../../icons/right-arrow.svg?component';
import { generateStackedNotePath } from '../../hooks/useNoteClick';
import { paths } from '../../paths';
import { useMedia } from 'react-use';
import { BacklinkedNote } from './BacklinkedNote';
import {
  useBlocksScopesService,
  useCurrentVaultId,
  useNotesService,
  useVaultService,
} from '../../hooks/vaultAppHooks';
import {
  FocusedBlockState,
  useFocusedBlock,
} from '../../hooks/useFocusedBlockState';

export interface IFocusBlockState {
  focusOnBlockId: string;
}

const BacklinkedNotes = observer(({ note }: { note: NoteModel }) => {
  const vaultService = useVaultService();
  const blocksScopesService = useBlocksScopesService();

  const backlinks$ = useObservable(
    ($inputs) => {
      return $inputs.pipe(
        switchMap(([note]) =>
          vaultService
            .getLinksOfNote$(note.$modelId)
            .pipe(map((noteLinks) => ({ noteLinks: noteLinks, note }))),
        ),
        switchMap(({ noteLinks, note }) =>
          noteLinks.length
            ? blocksScopesService
                .getBlocksScopes$(
                  noteLinks.flatMap((linkedNote) =>
                    linkedNote.linkedBlockIds.map((blockId) => ({
                      noteId: linkedNote.note.$modelId,
                      scopedBy: note,
                      rootBlockViewId: blockId,
                    })),
                  ),
                )
                .pipe(
                  map((scopes) => ({
                    referencesCount: scopes.length,
                    groupedScopes: groupBy(scopes, 'noteId'),
                    noteLinks: noteLinks,
                    note,
                  })),
                )
            : of({ referencesCount: 0, groupedScopes: {}, noteLinks, note }),
        ),
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

      {backlinks.areLoaded &&
        backlinks.noteLinks.map((link) => (
          <BacklinkedNote
            key={link.note.$modelId}
            note={link.note}
            scopes={backlinks.groupedScopes[link.note.$modelId]}
          />
        ))}
    </>
  );
});

const noteClass = bem('note');

const NoteBody = observer(({ note }: { note: NoteModel }) => {
  const vaultId = useCurrentVaultId();
  const isWide = useMedia('(min-width: 768px)');
  const location = useLocation();
  const focusedBlock = useFocusedBlock();
  const noteRepo = useVaultService();
  const history = useHistory<IFocusBlockState>();
  const focusOnBlockId = (history.location.state || {}).focusOnBlockId;

  const [noteTitle, setNoteTitle] = useState(note.title);

  useEffect(() => {
    setNoteTitle(note.title);
  }, [note.title]);

  const changeTitle = useCallback(async () => {
    if (note.title === noteTitle) return;

    const result = await noteRepo.updateNoteTitle(note.$modelId, noteTitle);

    if (result === 'exists') {
      alert(
        `Can't change note title to ${noteTitle} - such note already exists`,
      );

      setNoteTitle(note.title);
    }
  }, [note, noteRepo, noteTitle]);

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

  const handleArrowClick = useCallback(
    async (ev: React.MouseEvent, direction: 'next' | 'prev') => {
      if (!note.dailyNoteDate) return;

      const noteDate = dayjs.unix(note.dailyNoteDate / 1000);

      console.log(note.dailyNoteDate, { noteDate });

      const result = await (async () => {
        if (direction === 'next') {
          return await noteRepo.getOrCreateDailyNote(noteDate.add(1, 'day'));
        } else {
          return await noteRepo.getOrCreateDailyNote(
            noteDate.subtract(1, 'day'),
          );
        }
      })();

      if (result.status === 'ok') {
        if ((ev.nativeEvent as MouseEvent).shiftKey && note.$modelId) {
          history.replace(
            generateStackedNotePath(
              location.search,
              vaultId,
              note.$modelId,
              result.data.$modelId,
            ),
          );
        } else {
          history.replace(
            paths.vaultNotePath({
              vaultId: vaultId,
              noteId: result.data.$modelId,
            }) + location.search,
          );
        }
      }
    },
    [
      history,
      location.search,
      note.$modelId,
      note.dailyNoteDate,
      noteRepo,
      vaultId,
    ],
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

      <NoteBlocks note={note} />

      <BacklinkedNotes note={note} />
    </div>
  );
});

// Performance optimization here with context and separate component
export const Note: React.FC<{ note: NoteModel }> = React.memo(({ note }) => {
  const currentBlockInputRef = useRef<HTMLTextAreaElement>(null);

  return (
    <CurrentBlockInputRefContext.Provider value={currentBlockInputRef}>
      <NoteBody note={note} />
    </CurrentBlockInputRefContext.Provider>
  );
});
