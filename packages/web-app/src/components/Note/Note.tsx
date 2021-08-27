import React, { ChangeEvent, useCallback, useRef } from 'react';
import './styles.css';
import { useEffect } from 'react';
import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { NoteModel, FocusedBlockState, toObserver } from '@harika/web-core';
import { computed } from 'mobx';
import { useHistory } from 'react-router-dom';
import { LinkIcon } from '@heroicons/react/solid';
import { useCurrentVault } from '../../hooks/useCurrentVault';
import { CurrentBlockInputRefContext } from '../../contexts';
import { useNotesService } from '../../contexts/CurrentNotesServiceContext';
import { NoteBlocks } from './NoteBlocks';
import { BacklinkedNote } from './BacklinkedNote';
import { uniq } from 'lodash-es';
import { useObservable, useObservableState } from 'observable-hooks';
import { map, of, switchMap, tap } from 'rxjs';
import { comparer } from 'mobx';

export interface IFocusBlockState {
  focusOnBlockId: string;
}

const BacklinkedNoteLoader = observer(
  ({ linkedNote, note }: { linkedNote: NoteModel; note: NoteModel }) => {
    const noteRepo = useNotesService();

    const blocksTreeHolder$ = useObservable(
      ($inputs) => {
        return noteRepo.getBlocksTreeHolder$($inputs.pipe(map(([id]) => id)));
      },
      [linkedNote.$modelId],
    );

    const blocksTreeHolder = useObservableState(blocksTreeHolder$, undefined);

    const linkedBlocks = computed(
      () => {
        return blocksTreeHolder
          ? blocksTreeHolder.getLinkedBlocksOfNoteId(note.$modelId)
          : [];
      },
      { equals: comparer.shallow },
    ).get();

    return (
      <>
        {blocksTreeHolder && (
          <BacklinkedNote
            key={linkedNote.$modelId}
            note={linkedNote}
            blocks={linkedBlocks}
            treeHolder={blocksTreeHolder}
          />
        )}
      </>
    );
  },
);

const BacklinkedNotes = observer(({ note }: { note: NoteModel }) => {
  const noteRepo = useNotesService();

  const backlinks$ = useObservable(
    ($inputs) => {
      return $inputs.pipe(
        tap(([note]) => {
          console.log({ note });
        }),
        switchMap(([note]) =>
          noteRepo
            .getLinkedNotes$(note.$modelId)
            .pipe(map((linkedNotes) => ({ linkedNotes, note }))),
        ),
        switchMap(({ linkedNotes, note }) =>
          noteRepo
            .getBlocksTreeHolderByNoteIds$(
              of(linkedNotes.map(({ $modelId }) => $modelId)),
            )
            .pipe(map((treeHolders) => ({ treeHolders, note, linkedNotes }))),
        ),
        switchMap(({ treeHolders, linkedNotes }) =>
          toObserver(() =>
            uniq(
              treeHolders.flatMap((holder) =>
                holder.getLinkedBlocksOfNoteId(note.$modelId),
              ),
            ),
          ).pipe(map((allBlocks) => ({ linkedNotes, allBlocks }))),
        ),
        switchMap(async ({ linkedNotes, allBlocks }) => {
          await noteRepo.preloadOrCreateBlocksViews(note, allBlocks);

          return { areLoaded: true, linkedNotes, allBlocks };
        }),
      );
    },
    [note],
  );

  const backlinks = useObservableState(backlinks$, {
    areLoaded: false,
    linkedNotes: [],
    allBlocks: [],
  });

  return (
    <>
      {backlinks.areLoaded ? (
        <div className="note__linked-references">
          <LinkIcon className="note__link-icon" style={{ width: 16 }} />
          {backlinks.allBlocks.length} Linked References
        </div>
      ) : (
        <div className="note__linked-references">
          <LinkIcon className="note__link-icon" style={{ width: 16 }} />
          References are loading...
        </div>
      )}

      {backlinks.areLoaded &&
        backlinks.linkedNotes.map((linkedNote) => (
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
  const noteRepo = useNotesService();
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
