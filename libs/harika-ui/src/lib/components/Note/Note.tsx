import React, { ChangeEvent, useCallback, useContext, useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { NoteBlock } from '../NoteBlock/NoteBlock';
import './styles.css';
import { useEffect } from 'react';
import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  NoteBlockModel,
  NoteModel,
  BlocksViewModel,
  FocusedBlockState,
} from '@harika/harika-front-core';
import { Link, useHistory } from 'react-router-dom';
import { Link as LinkIcon } from 'heroicons-react';
import groupBy from 'lodash.groupby';
import clsx from 'clsx';
import { Arrow } from '../Arrow/Arrow';
import { paths } from '../../paths';
import { useCurrentVault } from '../../hooks/useCurrentVault';
import { useCurrentVaultUiState } from '../../contexts/CurrentVaultUiStateContext';
import { Toolbar } from './Toolbar';
import { useMedia } from 'react-use';
import { useNoteRepository } from '../../contexts/CurrentNoteRepositoryContext';
import { Ref } from 'mobx-keystone';
import { BlockContentModel } from '@harika/harika-front-core';
import { CurrentBlockInputRefContext } from '../../contexts';

export interface IFocusBlockState {
  focusOnBlockId: string;
}

const BacklinkedNote = observer(
  ({ note, blocks }: { note: NoteModel; blocks: NoteBlockModel[] }) => {
    const vault = useCurrentVault();
    const [isExpanded, setIsExpanded] = useState(true);

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
          <Link
            to={paths.vaultNotePath({
              vaultId: vault.$modelId,
              noteId: note.$modelId,
            })}
          >
            {note.title}
          </Link>
        </div>

        <div
          className={clsx('backlinked-note__noteblocks', {
            'backlinked-note__noteblocks--expanded': isExpanded,
          })}
        >
          {blocks.map((noteBlock) => {
            const path = noteBlock.path;

            return (
              <div
                key={noteBlock.$modelId}
                className="backlinked-note__noteblock-root"
              >
                {path.length > 0 && (
                  <div className="backlinked-note__noteblock-path">
                    {path.map((n, i) => (
                      <div
                        className={clsx(
                          'backlinked-note__noteblock-path-step',
                          {
                            'backlinked-note__noteblock-path-step--last':
                              i === path.length - 1,
                          }
                        )}
                        key={n.$modelId}
                      >
                        {n.content.value.trim().length === 0
                          ? '[blank]'
                          : n.content.value}
                      </div>
                    ))}
                  </div>
                )}
                <NoteBlock
                  noteBlock={noteBlock}
                  view={vault.getOrCreateViewByModel(noteBlock)}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

const Backlinks = observer(
  ({ linkedBlocks }: { linkedBlocks: NoteBlockModel[] }) => {
    return (
      <>
        {Object.entries(
          groupBy(linkedBlocks, (block): string => block.noteRef.id)
        ).map(([, blocks]) => {
          const note = blocks[0].noteRef.current;

          return (
            <BacklinkedNote key={note.$modelId} note={note} blocks={blocks} />
          );
        })}
      </>
    );
  }
);

const NoteBlocks = observer(
  ({
    childBlocks,
    view,
  }: {
    childBlocks: Ref<NoteBlockModel>[];
    view: BlocksViewModel;
  }) => {
    const isWide = useMedia('(min-width: 768px)');

    return (
      <>
        <div className="note__body">
          {childBlocks.map((noteBlock) => (
            <NoteBlock
              key={noteBlock.current.$modelId}
              noteBlock={noteBlock.current}
              view={view}
            />
          ))}
        </div>
        {!isWide && <Toolbar view={view} />}
      </>
    );
  }
);

export const Note: React.FC<{ note: NoteModel }> = observer(({ note }) => {
  const vault = useCurrentVault();
  const vaultUiState = useCurrentVaultUiState();
  const history = useHistory<IFocusBlockState>();
  const focusOnBlockId = (history.location.state || {}).focusOnBlockId;
  const noteRepo = useNoteRepository();

  const currentBlockInputRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      note.updateTitle(e.target.value);
    },
    [note]
  );

  useEffect(() => {
    if (focusOnBlockId) {
      vaultUiState.setFocusedBlock(
        FocusedBlockState.create(note.$modelId, focusOnBlockId)
      );
    }
  }, [focusOnBlockId, note.$modelId, vaultUiState]);

  const populateNotes = useCallback(() => {
    /* for (let i = 0; i < 1000; i++) { */
    /*   console.log('create note!'); */
    /*   noteRepo.createNote(vault, { title: `Test note ${Date.now() + i}` }); */
    /* } */
    for (let i = 0; i < 100; i++) {
      const block = note.createBlock(
        { content: new BlockContentModel({ value: 'test' }) },
        note.rootBlockRef.current,
        i
      );
      console.log('create block');
    }
  }, [note]);

  return (
    <CurrentBlockInputRefContext.Provider value={currentBlockInputRef}>
      <div className="note">
        <h2 className="note__header">
          <TextareaAutosize
            className="note__input"
            value={note.title}
            onChange={handleChange}
          />
        </h2>

        <NoteBlocks
          view={vault.getOrCreateViewByModel(note)}
          childBlocks={note.rootBlockRef.current.noteBlockRefs}
        />

        <div className="note__linked-references">
          <LinkIcon className="note__link-icon" size={16} />
          {note.linkedBlocks.length} Linked References
        </div>

        <Backlinks linkedBlocks={note.linkedBlocks} />
      </div>
    </CurrentBlockInputRefContext.Provider>
  );
});
