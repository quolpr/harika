import clsx from 'clsx';
import { observer } from 'mobx-react-lite';
import React, { useEffect, useState } from 'react';
import { useCurrentNote } from '../../hooks/useCurrentNote';
import { useCurrentVault } from '../../hooks/useCurrentVault';
import { useHandleClick } from '../../hooks/useNoteClick';
import { Arrow } from '../Arrow/Arrow';
import { Link, useLocation } from 'react-router-dom';
import { paths } from '../../paths';
import type {
  BlocksTreeHolder,
  NoteBlockModel,
  NoteModel,
} from '@harika/web-core';
import { useNotesService } from '../../contexts/CurrentNotesServiceContext';
import { computed } from 'mobx';
import { NoteBlock } from '../NoteBlock/NoteBlock';
import { NoteBlocksHandlers } from './NoteBlocksHandlers';

const LinkedBlock = observer(
  ({
    note,
    noteBlock,
    treeHolder,
  }: {
    note: NoteModel;
    noteBlock: NoteBlockModel;
    treeHolder: BlocksTreeHolder;
  }): JSX.Element => {
    const vault = useCurrentVault();
    const path = noteBlock.path;
    const currentNote = useCurrentNote()!;
    const noteRepo = useNotesService();

    const view = computed(() => {
      return vault.ui.getView(currentNote, noteBlock);
    }).get();

    useEffect(() => {
      if (!view) {
        noteRepo.preloadOrCreateBlocksView(currentNote, noteBlock);
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

        {view && (
          <NoteBlocksHandlers
            note={note}
            view={view}
            blocksTreeHolder={treeHolder}
          />
        )}
        {view && <NoteBlock noteBlock={noteBlock} view={view} />}
      </div>
    );
  },
);

export const BacklinkedNote = observer(
  ({
    note,
    blocks,
    treeHolder,
  }: {
    note: NoteModel;
    blocks: NoteBlockModel[];
    treeHolder: BlocksTreeHolder;
  }) => {
    const vault = useCurrentVault();
    const [isExpanded, setIsExpanded] = useState(true);
    const currentNote = useCurrentNote();
    const location = useLocation();

    const handleClick = useHandleClick(
      vault,
      currentNote?.$modelId,
      note?.$modelId,
    );

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
            to={
              note
                ? paths.vaultNotePath({
                    vaultId: vault.$modelId,
                    noteId: note.$modelId,
                  }) + location.search
                : ''
            }
            onClick={handleClick}
          >
            {note.title}
          </Link>
        </div>

        <div
          className={clsx('backlinked-note__noteblocks', {
            'backlinked-note__noteblocks--expanded': isExpanded,
          })}
        >
          {blocks.map((noteBlock) => (
            <LinkedBlock
              key={noteBlock.$modelId}
              note={note}
              noteBlock={noteBlock}
              treeHolder={treeHolder}
            />
          ))}
        </div>
      </div>
    );
  },
);
