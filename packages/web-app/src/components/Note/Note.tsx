import React, { ChangeEvent, useCallback, useRef } from 'react';
import './styles.css';
import { useEffect } from 'react';
import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { NoteModel, FocusedBlockState } from '@harika/web-core';
import { computed } from 'mobx';
import { useHistory } from 'react-router-dom';
import { LinkIcon } from '@heroicons/react/solid';
import { useCurrentVault } from '../../hooks/useCurrentVault';
import { CurrentBlockInputRefContext } from '../../contexts';
import { useNoteRepository } from '../../contexts/CurrentNoteRepositoryContext';
import { NoteBlocks } from './NoteBlocks';
import { BacklinkedNote } from './BacklinkedNote';
import { useAsync } from 'react-use';
import { uniq } from 'lodash-es';
import { useObservable, useObservableState } from 'observable-hooks';
import { switchMap } from 'rxjs';

export interface IFocusBlockState {
  focusOnBlockId: string;
}

const BacklinkedNoteLoader = observer(
  ({ linkedNote, note }: { linkedNote: NoteModel; note: NoteModel }) => {
    const noteRepo = useNoteRepository();

    const blockTreeHolderState = useAsync(
      () => noteRepo.getBlocksTreeHolder(linkedNote.$modelId),
      [noteRepo, linkedNote.$modelId],
    );

    const linkedBlocks = computed(() => {
      return blockTreeHolderState.value
        ? blockTreeHolderState.value.getLinkedBlocksOfNoteId(note.$modelId)
        : [];
    }).get();

    return (
      <>
        {blockTreeHolderState.value && (
          <BacklinkedNote
            key={linkedNote.$modelId}
            note={linkedNote}
            blocks={linkedBlocks}
            treeHolder={blockTreeHolderState.value}
          />
        )}
      </>
    );
  },
);

const BacklinkedNotes = observer(({ note }: { note: NoteModel }) => {
  const noteRepo = useNoteRepository();

  const linkedNotes$ = useObservable(
    ($inputs) =>
      $inputs.pipe(switchMap(([noteId]) => noteRepo.getLinkedNotes$(noteId))),
    [note.$modelId],
  );
  const linkedNotes = useObservableState(linkedNotes$, undefined);

  const blockState = useAsync(async () => {
    if (!linkedNotes) return { isLoaded: false } as const;

    // Just batch loading, for optimization
    const treeHolders = await noteRepo.getBlocksTreeHolderByNoteIds(
      linkedNotes.map(({ $modelId }) => $modelId),
    );

    const allBlocks = uniq(
      treeHolders.flatMap((holder) =>
        holder.getLinkedBlocksOfNoteId(note.$modelId),
      ),
    );

    await noteRepo.preloadOrCreateBlocksViews(note, allBlocks);

    return { isLoaded: true, refsCount: allBlocks.length } as const;
  }, [noteRepo, linkedNotes, note]);

  return (
    <>
      {blockState.value?.refsCount !== undefined ? (
        <div className="note__linked-references">
          <LinkIcon className="note__link-icon" style={{ width: 16 }} />
          {blockState.value.refsCount} Linked References
        </div>
      ) : (
        <div className="note__linked-references">
          <LinkIcon className="note__link-icon" style={{ width: 16 }} />
          References are loading...
        </div>
      )}

      {linkedNotes &&
        blockState.value?.isLoaded === true &&
        linkedNotes.map((linkedNote) => (
          <BacklinkedNoteLoader
            key={linkedNote.$modelId}
            linkedNote={linkedNote}
            note={note}
          />
        ))}
    </>
  );
});

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
      noteRepo.preloadOrCreateBlocksView(note, note);
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

      {view && <NoteBlocks note={note} view={view} />}

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
