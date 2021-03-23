import React, { ChangeEvent, useCallback, useMemo } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { NoteBlock } from '../NoteBlock/NoteBlock';
import './styles.css';
import { useEffect } from 'react';
import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  NoteBlockModel,
  NoteModel,
  NoteLinkModel,
  BlocksViewModel,
  FocusedBlockState,
} from '@harika/harika-core';
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

export interface IFocusBlockState {
  focusOnBlockId: string;
}

const BacklinkedNote = observer(
  ({ note, links }: { note: NoteModel; links: NoteLinkModel[] }) => {
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
          {links.map((currentLink) => {
            const noteBlock = currentLink.noteBlockRef.current;
            const path = noteBlock.path;

            return (
              <div
                key={currentLink.$modelId}
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
                        {n.content.trim().length === 0 ? '[blank]' : n.content}
                      </div>
                    ))}
                  </div>
                )}
                <NoteBlock
                  noteBlock={noteBlock}
                  view={vault.getOrCreateViewByModel(currentLink)}
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
  ({ noteBlockLinks }: { noteBlockLinks: NoteLinkModel[] }) => {
    return (
      <>
        {Object.entries(
          groupBy(
            noteBlockLinks,
            ({ noteBlockRef }: NoteLinkModel): string =>
              noteBlockRef.current.noteRef.id
          )
        ).map(([, links]) => {
          const note = links[0].noteBlockRef.current.noteRef.current;

          return (
            <BacklinkedNote key={note.$modelId} note={note} links={links} />
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
    childBlocks: NoteBlockModel[];
    view: BlocksViewModel;
  }) => {
    const isWide = useMedia('(min-width: 768px)');

    return (
      <>
        <div className="note__body">
          {childBlocks.map((noteBlock) => (
            <NoteBlock
              key={noteBlock.$modelId}
              noteBlock={noteBlock}
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

  return (
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
        childBlocks={note.children}
      />

      <div className="note__linked-references">
        <LinkIcon className="note__link-icon" size={16} />
        {note.noteBlockLinks.length} Linked References
      </div>

      <Backlinks noteBlockLinks={note.noteBlockLinks} />
    </div>
  );
});
