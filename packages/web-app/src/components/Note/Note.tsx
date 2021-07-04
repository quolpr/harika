import React, { ChangeEvent, useCallback, useRef } from 'react';
import { NoteBlock } from '../NoteBlock/NoteBlock';
import './styles.css';
import { useEffect } from 'react';
import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  NoteBlockModel,
  NoteModel,
  FocusedBlockState,
  BlocksViewModel,
} from '@harika/web-core';
import { computed } from 'mobx';
import { Link, useHistory } from 'react-router-dom';
import { LinkIcon } from '@heroicons/react/solid';
import { groupBy } from 'lodash-es';
import clsx from 'clsx';
import { Arrow } from '../Arrow/Arrow';
import { paths } from '../../paths';
import { useCurrentVault } from '../../hooks/useCurrentVault';
import { CurrentBlockInputRefContext } from '../../contexts';
import { useNoteRepository } from '../../contexts/CurrentNoteRepositoryContext';
import { NoteBlocks } from './NoteBlocks';
import { useCurrentNote } from '../../hooks/useCurrentNote';
import { useNotePath } from '../../hooks/useNoteClick';

export interface IFocusBlockState {
  focusOnBlockId: string;
}

const LinkedBlock = observer(({ noteBlock }: { noteBlock: NoteBlockModel }) => {
  const vault = useCurrentVault();
  const path = noteBlock.path;
  const note = useCurrentNote()!;

  const view = computed(() => {
    return vault.ui.getView(note, noteBlock);
  }).get();

  useEffect(() => {
    if (!view) {
      vault.ui.createViewByModel(note, noteBlock);
    }
  });

  return (
    <div key={noteBlock.$modelId} className="backlinked-note__noteblock-root">
      {path.length > 1 && (
        <div className="backlinked-note__noteblock-path">
          {path.slice(1).map((n, i) => (
            <div
              className={clsx('backlinked-note__noteblock-path-step', {
                'backlinked-note__noteblock-path-step--last':
                  i === path.length - 1,
              })}
              key={n.$modelId}
            >
              {n.content.value.trim().length === 0
                ? '[blank]'
                : n.content.value}
            </div>
          ))}
        </div>
      )}

      {view && <NoteBlock noteBlock={noteBlock} view={view} />}
    </div>
  );
});

const BacklinkedNote = observer(
  ({ note, blocks }: { note: NoteModel; blocks: NoteBlockModel[] }) => {
    const vault = useCurrentVault();
    const [isExpanded, setIsExpanded] = useState(true);
    const currentNote = useCurrentNote();

    const notePath = useNotePath(vault, currentNote?.$modelId, note.$modelId);

    return (
      <div className="backlinked-note">
        <div
          className={clsx('backlinked-note__title', {
            'backlinked-note__title--expanded': isExpanded,
          })}
        >
          <Arrow
            className="backlinked-note__arrow"
            isExpanded={isExpanded}
            onToggle={() => {
              setIsExpanded(!isExpanded);
            }}
          />
          <Link to={notePath}>{note.title}</Link>
        </div>

        <div
          className={clsx('backlinked-note__noteblocks', {
            'backlinked-note__noteblocks--expanded': isExpanded,
          })}
        >
          {blocks.map((noteBlock) => (
            <LinkedBlock key={noteBlock.$modelId} noteBlock={noteBlock} />
          ))}
        </div>
      </div>
    );
  },
);

const Backlinks = observer(
  ({ linkedBlocks }: { linkedBlocks: NoteBlockModel[] }) => {
    return (
      <>
        {Object.entries(
          groupBy(linkedBlocks, (block): string => block.noteRef.id),
        ).map(([, blocks]) => {
          const note = blocks[0].noteRef.current;

          return (
            <BacklinkedNote key={note.$modelId} note={note} blocks={blocks} />
          );
        })}
      </>
    );
  },
);

// TODO: on NoteBlock change it still rerenders. Why?
const NoteBody = observer(({ note }: { note: NoteModel }) => {
  const vault = useCurrentVault();
  const noteRepo = useNoteRepository();
  const history = useHistory<IFocusBlockState>();
  const focusOnBlockId = (history.location.state || {}).focusOnBlockId;

  const [noteTitle, setNoteTitle] = useState(note.title);

  useEffect(() => {
    setNoteTitle(note.title);
  }, [note.title]);

  const changeTitle = useCallback(async () => {
    if (note.title === noteTitle) return;

    const exists = await noteRepo.isNoteExists(noteTitle);

    if (exists) {
      alert(
        `Can't change note title to ${noteTitle} - such note already exists`,
      );

      setNoteTitle(note.title);
    } else {
      note.updateTitle(noteTitle);
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
      vault.ui.focusedBlock.setState(
        FocusedBlockState.create(note.$modelId, focusOnBlockId),
      );
    }
  }, [focusOnBlockId, note.$modelId, vault.ui]);

  const inputId = `note-title-input-${note.$modelId}`;

  const view = computed(() => {
    return vault.ui.getView(note, note);
  }).get();

  useEffect(() => {
    if (!view) {
      vault.ui.createViewByModel(note, note);
    }
  });

  return (
    <div className="note">
      <h2 className="note__header">
        <label htmlFor={inputId} className="hidden-label">
          Note title
        </label>
        <input
          id={inputId}
          className="note__input"
          value={noteTitle}
          onBlur={changeTitle}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
      </h2>

      {view && (
        <NoteBlocks
          note={note}
          view={view}
          childBlocks={note.rootBlockRef.current.noteBlockRefs}
        />
      )}

      <div className="note__linked-references">
        <LinkIcon className="note__link-icon" style={{ width: 16 }} />
        {note.linkedBlocks.length} Linked References
      </div>

      <Backlinks linkedBlocks={note.linkedBlocks} />
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
